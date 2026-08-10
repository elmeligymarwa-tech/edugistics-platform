'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import type { EmailStatus } from '@prisma/client'
import { CampaignEmailType } from '@/domain/training/schema'
import { ADMIN_ACTOR, writeAuditLog } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { runAfterResponse } from '@/lib/training/background'
import { renderCampaignEmail } from '@/lib/training/email/campaign-render'
import { contentSchema, criteriaInputSchema, fieldErrorsFromZod, toCriteria, type RecipientCriteriaInput } from '@/lib/training/email/criteria'
import { resolveRecipients, toPersonalizationValues } from '@/lib/training/email/recipients'
import { validateBulkEmailConfig } from '@/lib/training/email/resend-client'
import {
  dispatchTestEmail,
  findRecentDuplicateTeacherIds,
  getMaxRecipientsPerCampaign,
  processCampaignSend,
} from '@/lib/training/email/send-campaign'
import { prisma } from '@/lib/training/prisma'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/training/rate-limit'

const SEND_RATE_LIMIT = 20
const SEND_RATE_WINDOW_MS = 60 * 60 * 1000
const RETRY_RATE_LIMIT = 30
const RETRY_RATE_WINDOW_MS = 60 * 60 * 1000
const TEST_RATE_LIMIT = 10
const TEST_RATE_WINDOW_MS = 10 * 60 * 1000

/** In-memory only, matching the rest of this app's rate limiter — a first layer, not a durable guarantee across instances. */
async function ipKey(prefix: string): Promise<string> {
  const store = await headers()
  return `${prefix}:${clientIpFromHeaders(store)}`
}

const sendCampaignInputSchema = z.object({
  criteria: criteriaInputSchema,
  emailType: CampaignEmailType,
  content: contentSchema,
  confirmedCount: z.number().int().nonnegative(),
  overrideDuplicates: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
})

export type SendCampaignResult =
  | { success: true; data: { campaignId: string } }
  | { success: false; kind: 'validation'; error: string; fieldErrors?: Record<string, string> }
  | { success: false; kind: 'count-mismatch'; error: string; resolvedCount: number }
  | { success: false; kind: 'over-limit'; error: string; max: number; resolvedCount: number }
  | { success: false; kind: 'duplicates'; duplicateCount: number; totalCount: number }
  | { success: false; kind: 'rate-limited'; error: string }
  | { success: false; kind: 'config'; error: string; missing: string }

/**
 * Guards only the actual campaign-creation step, not the read-only checks
 * before it — those (recipient resolution, count/limit/duplicate checks) are
 * safe to repeat. A literal double click reaches this map with the same
 * idempotencyKey and the second call gets back the first call's own
 * in-flight promise instead of creating a second campaign. There is no
 * `await` between the `.get()` and `.set()` below, so this check-and-set is
 * atomic on Node's single thread regardless of how close together the two
 * calls arrive.
 */
const inFlightCreations = new Map<string, Promise<SendCampaignResult>>()
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000

async function createCampaignAndSchedule(
  input: z.infer<typeof sendCampaignInputSchema>,
  resolution: Awaited<ReturnType<typeof resolveRecipients>>,
  duplicateCount: number,
): Promise<SendCampaignResult> {
  const courseId = resolution.courses.length === 1 ? resolution.courses[0]!.id : null

  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.emailCampaign.create({
      data: {
        courseId,
        subject: input.content.subject,
        bodyTemplate: input.content.body,
        emailType: input.emailType,
        createdBy: ADMIN_ACTOR,
        recipientCount: resolution.uniqueTeacherCount,
        sentCount: 0,
        failedCount: 0,
      },
    })

    await tx.emailCampaignRecipient.createMany({
      data: resolution.recipients.map((recipient) => ({
        campaignId: created.id,
        teacherId: recipient.teacherId,
        registrationId: recipient.registrationId,
        emailAddress: recipient.email,
        status: 'PENDING' as const,
      })),
    })

    await tx.auditLog.create({
      data: {
        actor: ADMIN_ACTOR,
        action: 'EMAIL_CAMPAIGN_SENT',
        entityType: 'EmailCampaign',
        entityId: created.id,
        afterJson: {
          recipientCount: resolution.uniqueTeacherCount,
          emailType: input.emailType,
          courseId,
          duplicateCount,
          duplicateWarningOverridden: duplicateCount > 0 && Boolean(input.overrideDuplicates),
        },
      },
    })

    return created
  })

  runAfterResponse(() => processCampaignSend(campaign.id))

  return { success: true, data: { campaignId: campaign.id } }
}

/**
 * Validates, re-resolves recipients fresh from the database (never trusting
 * anything the client claims about who they are), aborts on a mismatch
 * against the count the administrator typed to confirm, blocks above the
 * safety limit, and warns on recent duplicates before ever writing a
 * campaign row. Only once all of that has passed does it create the
 * EmailCampaign + EmailCampaignRecipient manifest and hand the actual
 * sending off to run after this request returns.
 */
async function executeSend(input: z.infer<typeof sendCampaignInputSchema>): Promise<SendCampaignResult> {
  // Checked first and cheaply, before any database work: a misconfigured
  // server must refuse to send at all, not create a campaign it can never
  // deliver. This is what would have caught the MARKETING_EMAIL_FROM
  // misspelling before it ever wrote a row, on the marketing path's
  // equivalent of this check.
  const missing = validateBulkEmailConfig()
  if (missing) {
    return {
      success: false,
      kind: 'config',
      error: `Email sending is not configured — ${missing} is missing on the server. Contact an administrator before sending.`,
      missing,
    }
  }

  const resolution = await resolveRecipients(toCriteria(input.criteria))

  if (resolution.uniqueTeacherCount === 0) {
    return { success: false, kind: 'validation', error: 'No recipients match this selection.' }
  }

  if (resolution.uniqueTeacherCount !== input.confirmedCount) {
    return {
      success: false,
      kind: 'count-mismatch',
      error: `The recipient list has changed since you confirmed the count (was ${input.confirmedCount}, now ${resolution.uniqueTeacherCount}). Refresh the preview and try again.`,
      resolvedCount: resolution.uniqueTeacherCount,
    }
  }

  const max = getMaxRecipientsPerCampaign()
  if (resolution.uniqueTeacherCount > max) {
    return {
      success: false,
      kind: 'over-limit',
      error: `This selection has ${resolution.uniqueTeacherCount} recipients, above the maximum of ${max} per campaign. Narrow the selection and try again.`,
      max,
      resolvedCount: resolution.uniqueTeacherCount,
    }
  }

  const duplicateTeacherIds = await findRecentDuplicateTeacherIds(resolution.recipients, input.emailType)
  if (duplicateTeacherIds.size > 0 && !input.overrideDuplicates) {
    return {
      success: false,
      kind: 'duplicates',
      duplicateCount: duplicateTeacherIds.size,
      totalCount: resolution.uniqueTeacherCount,
    }
  }

  const existing = inFlightCreations.get(input.idempotencyKey)
  if (existing) return existing

  const creation = createCampaignAndSchedule(input, resolution, duplicateTeacherIds.size)
  inFlightCreations.set(input.idempotencyKey, creation)
  creation.finally(() => {
    setTimeout(() => inFlightCreations.delete(input.idempotencyKey), IDEMPOTENCY_TTL_MS)
  })
  return creation
}

export async function sendCampaignAction(input: {
  criteria: RecipientCriteriaInput
  emailType: string
  content: { subject: string; body: string }
  confirmedCount: number
  overrideDuplicates?: boolean
  idempotencyKey: string
}): Promise<SendCampaignResult> {
  await requireAdminSession()

  const parsed = sendCampaignInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, kind: 'validation', error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  if (!checkRateLimit(await ipKey('training-bulk-send'), SEND_RATE_LIMIT, SEND_RATE_WINDOW_MS)) {
    return { success: false, kind: 'rate-limited', error: 'Too many campaigns sent recently. Try again later.' }
  }

  return executeSend(parsed.data)
}

export interface CampaignRecipientStatus {
  id: string
  teacherName: string
  emailAddress: string
  status: EmailStatus
  errorMessage: string | null
  sentAt: string | null
}

export interface CampaignStatus {
  id: string
  emailType: string
  subject: string
  recipientCount: number
  sentCount: number
  failedCount: number
  createdAt: string
  recipients: CampaignRecipientStatus[]
}

export type StatusResult = { success: true; data: CampaignStatus } | { success: false; error: string }

/** Always reads fresh from the database — the true state, whether polled mid-send or reopened long after the browser that started it was closed. */
export async function getCampaignStatusAction(campaignId: string): Promise<StatusResult> {
  await requireAdminSession()

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: {
        select: { id: true, emailAddress: true, status: true, errorMessage: true, sentAt: true, teacher: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!campaign) return { success: false, error: 'Campaign not found.' }

  return {
    success: true,
    data: {
      id: campaign.id,
      emailType: campaign.emailType,
      subject: campaign.subject,
      recipientCount: campaign.recipientCount,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      createdAt: campaign.createdAt.toISOString(),
      recipients: campaign.recipients.map((recipient) => ({
        id: recipient.id,
        teacherName: recipient.teacher.fullName,
        emailAddress: recipient.emailAddress,
        status: recipient.status,
        errorMessage: recipient.errorMessage,
        sentAt: recipient.sentAt?.toISOString() ?? null,
      })),
    },
  }
}

export type RetryResult = { success: true; data: { retriedCount: number } } | { success: false; error: string }

/**
 * A campaign is treated as orphaned — its PENDING rows recoverable — only
 * once nothing about it has changed in a very long time. Every recipient
 * outcome (SENT/FAILED/SKIPPED) writes through recordSent/recordFailed in
 * the same transaction that increments the campaign's own sentCount/
 * failedCount, which bumps the campaign row's updatedAt as a side effect —
 * so updatedAt is a heartbeat for the whole queue, not just one row, with no
 * schema change needed to track it separately. A genuinely running queue
 * updates this at least every intervalMs (default ~500ms), and even a
 * single recipient stuck in the provider's rate-limit backoff only delays
 * it by up to ~63s (5 retries, doubling from 1s). Ten minutes is a full
 * order of magnitude beyond either case, so only a queue that has actually
 * stopped — crashed, killed by a platform timeout, or otherwise never
 * reached its own outer catch — will ever cross it. A PENDING row that is
 * merely queued behind other recipients in an active send is never touched,
 * because the campaign's updatedAt stays fresh the whole time.
 */
const ORPHAN_STALE_THRESHOLD_MS = 10 * 60 * 1000

/**
 * Re-sends recipients currently FAILED on this campaign, resetting them to
 * PENDING — and, when the campaign itself looks dead (see
 * ORPHAN_STALE_THRESHOLD_MS above), also recovers any recipient rows still
 * stuck at PENDING from a queue that aborted without ever reaching its own
 * FAILED-marking logic. Never touches a row already SENT, and updates this
 * same campaign's rows rather than creating a new one.
 */
export async function retryFailedRecipientsAction(campaignId: string): Promise<RetryResult> {
  await requireAdminSession()

  if (!checkRateLimit(await ipKey('training-bulk-retry'), RETRY_RATE_LIMIT, RETRY_RATE_WINDOW_MS)) {
    return { success: false, error: 'Too many retry attempts recently. Try again later.' }
  }

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return { success: false, error: 'Campaign not found.' }

  const failed = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId, status: 'FAILED' },
    select: { id: true },
  })

  const isOrphaned = Date.now() - campaign.updatedAt.getTime() > ORPHAN_STALE_THRESHOLD_MS
  const orphanedPending = isOrphaned
    ? await prisma.emailCampaignRecipient.findMany({ where: { campaignId, status: 'PENDING' }, select: { id: true } })
    : []

  const toRetry = [...failed, ...orphanedPending]
  if (toRetry.length === 0) return { success: true, data: { retriedCount: 0 } }

  await prisma.$transaction([
    prisma.emailCampaignRecipient.updateMany({
      where: { id: { in: toRetry.map((row) => row.id) } },
      data: { status: 'PENDING', errorMessage: null },
    }),
    prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { failedCount: { decrement: failed.length } },
    }),
  ])

  await writeAuditLog({
    action: 'EMAIL_CAMPAIGN_RETRY',
    entityType: 'EmailCampaign',
    entityId: campaignId,
    afterJson: { retriedCount: toRetry.length, recoveredOrphanedPendingCount: orphanedPending.length },
  })

  runAfterResponse(() => processCampaignSend(campaignId))

  return { success: true, data: { retriedCount: toRetry.length } }
}

const testEmailInputSchema = z.object({
  criteria: criteriaInputSchema,
  content: contentSchema,
  testAddress: z.string().trim().min(1, 'Enter an email address.').email('Enter a valid email address.'),
})

export type TestSendResult = { success: true; data: { messageId: string } } | { success: false; error: string; fieldErrors?: Record<string, string> }

/**
 * Sends exactly one message, rendered from a real recipient's resolved
 * values, to an address the administrator types. Creates no EmailCampaign or
 * EmailCampaignRecipient row and does not count as a send against any
 * teacher — this is a formatting check, not part of the audited send trail.
 */
export async function sendTestEmailAction(input: {
  criteria: RecipientCriteriaInput
  content: { subject: string; body: string }
  testAddress: string
}): Promise<TestSendResult> {
  await requireAdminSession()

  if (!checkRateLimit(await ipKey('training-bulk-test'), TEST_RATE_LIMIT, TEST_RATE_WINDOW_MS)) {
    return { success: false, error: 'Too many test sends recently. Try again shortly.' }
  }

  const parsed = testEmailInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  const resolution = await resolveRecipients(toCriteria(parsed.data.criteria))
  const example = resolution.recipients[0]
  if (!example) {
    return { success: false, error: 'No recipients match this selection yet — a test send needs at least one real recipient to resolve tokens from.' }
  }

  const rendered = renderCampaignEmail(parsed.data.content.subject, parsed.data.content.body, toPersonalizationValues(example))

  try {
    const messageId = await dispatchTestEmail(parsed.data.testAddress, rendered)
    return { success: true, data: { messageId } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send test email.' }
  }
}

