'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import type { MarketingRecipientStatus } from '@prisma/client'
import { EDUGISTICS_CONTACT_EMAIL } from '@/domain/training/contact'
import { toMarketingPersonalizationValues } from '@/domain/training/personalization'
import { ADMIN_ACTOR, writeAuditLog } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { runAfterResponse } from '@/lib/training/background'
import { contentSchema, fieldErrorsFromZod } from '@/lib/training/email/criteria'
import { buildListUnsubscribeHeaders } from '@/lib/training/email/marketing-headers'
import { renderMarketingEmail } from '@/lib/training/email/marketing-render'
import {
  dispatchTestMarketingEmail,
  getMaxMarketingRecipientsPerCampaign,
  processMarketingCampaignSend,
} from '@/lib/training/email/send-marketing-campaign'
import { prisma } from '@/lib/training/prisma'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/training/rate-limit'
import { getSiteUrl } from '@/lib/training/site-url'
import { subscriberCriteriaInputSchema, toSubscriberCriteria, type SubscriberCriteriaInput } from '@/lib/training/subscriber-criteria'
import { resolveMarketingRecipients } from '@/lib/training/subscribers-admin'
import { buildUnsubscribeUrl } from '@/lib/training/unsubscribe'

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

const sendMarketingCampaignInputSchema = z.object({
  criteria: subscriberCriteriaInputSchema,
  content: contentSchema,
  templateId: z.string().trim().min(1).optional(),
  confirmedCount: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(1).max(200),
})

export type SendMarketingCampaignResult =
  | { success: true; data: { campaignId: string } }
  | { success: false; kind: 'validation'; error: string; fieldErrors?: Record<string, string> }
  | { success: false; kind: 'count-mismatch'; error: string; resolvedCount: number }
  | { success: false; kind: 'over-limit'; error: string; max: number; resolvedCount: number }
  | { success: false; kind: 'rate-limited'; error: string }

/**
 * Guards only the actual campaign-creation step, not the read-only checks
 * before it. A literal double click reaches this map with the same
 * idempotencyKey and the second call gets back the first call's own
 * in-flight promise instead of creating a second campaign. There is no
 * `await` between the `.get()` and `.set()` below, so this check-and-set is
 * atomic on Node's single thread regardless of how close together the two
 * calls arrive.
 */
const inFlightCreations = new Map<string, Promise<SendMarketingCampaignResult>>()
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000

async function createMarketingCampaignAndSchedule(
  input: z.infer<typeof sendMarketingCampaignInputSchema>,
  recipients: Awaited<ReturnType<typeof resolveMarketingRecipients>>,
): Promise<SendMarketingCampaignResult> {
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.marketingCampaign.create({
      data: {
        subject: input.content.subject,
        bodyTemplate: input.content.body,
        templateId: input.templateId ?? null,
        createdBy: ADMIN_ACTOR,
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
      },
    })

    await tx.marketingCampaignRecipient.createMany({
      data: recipients.map((recipient) => ({
        campaignId: created.id,
        subscriberId: recipient.subscriberId,
        emailAddress: recipient.email,
        status: 'PENDING' as const,
      })),
    })

    await tx.auditLog.create({
      data: {
        actor: ADMIN_ACTOR,
        action: 'MARKETING_CAMPAIGN_SENT',
        entityType: 'MarketingCampaign',
        entityId: created.id,
        afterJson: { recipientCount: recipients.length, templateId: input.templateId ?? null },
      },
    })

    return created
  })

  runAfterResponse(() => processMarketingCampaignSend(campaign.id))

  return { success: true, data: { campaignId: campaign.id } }
}

/**
 * Re-resolves recipients fresh from the database (never trusting anything
 * the client claims about who is subscribed), aborts on a mismatch against
 * the count the administrator typed to confirm, and blocks above the safety
 * limit before ever writing a campaign row. Only once all of that has
 * passed does it create the MarketingCampaign + MarketingCampaignRecipient
 * manifest and hand the actual sending off to run after this request
 * returns.
 */
async function executeMarketingSend(input: z.infer<typeof sendMarketingCampaignInputSchema>): Promise<SendMarketingCampaignResult> {
  const recipients = await resolveMarketingRecipients(toSubscriberCriteria(input.criteria))

  if (recipients.length === 0) {
    return { success: false, kind: 'validation', error: 'No subscribed contacts match this selection.' }
  }

  if (recipients.length !== input.confirmedCount) {
    return {
      success: false,
      kind: 'count-mismatch',
      error: `The recipient list has changed since you confirmed the count (was ${input.confirmedCount}, now ${recipients.length}). Refresh the preview and try again.`,
      resolvedCount: recipients.length,
    }
  }

  const max = getMaxMarketingRecipientsPerCampaign()
  if (recipients.length > max) {
    return {
      success: false,
      kind: 'over-limit',
      error: `This selection has ${recipients.length} recipients, above the maximum of ${max} per campaign. Narrow the selection and try again.`,
      max,
      resolvedCount: recipients.length,
    }
  }

  const existing = inFlightCreations.get(input.idempotencyKey)
  if (existing) return existing

  const creation = createMarketingCampaignAndSchedule(input, recipients)
  inFlightCreations.set(input.idempotencyKey, creation)
  creation.finally(() => {
    setTimeout(() => inFlightCreations.delete(input.idempotencyKey), IDEMPOTENCY_TTL_MS)
  })
  return creation
}

export async function sendMarketingCampaignAction(input: {
  criteria: SubscriberCriteriaInput
  content: { subject: string; body: string }
  templateId?: string
  confirmedCount: number
  idempotencyKey: string
}): Promise<SendMarketingCampaignResult> {
  await requireAdminSession()

  const parsed = sendMarketingCampaignInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, kind: 'validation', error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  if (!checkRateLimit(await ipKey('training-marketing-send'), SEND_RATE_LIMIT, SEND_RATE_WINDOW_MS)) {
    return { success: false, kind: 'rate-limited', error: 'Too many campaigns sent recently. Try again later.' }
  }

  return executeMarketingSend(parsed.data)
}

export interface MarketingCampaignRecipientStatus {
  id: string
  emailAddress: string
  status: MarketingRecipientStatus
  errorMessage: string | null
  sentAt: string | null
}

export interface MarketingCampaignStatus {
  id: string
  subject: string
  recipientCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  createdAt: string
  recipients: MarketingCampaignRecipientStatus[]
}

export type MarketingStatusResult = { success: true; data: MarketingCampaignStatus } | { success: false; error: string }

/** Always reads fresh from the database — the true state, whether polled mid-send or reopened long after the browser that started it was closed. */
export async function getMarketingCampaignStatusAction(campaignId: string): Promise<MarketingStatusResult> {
  await requireAdminSession()

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: {
        select: { id: true, emailAddress: true, status: true, errorMessage: true, sentAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!campaign) return { success: false, error: 'Campaign not found.' }

  return {
    success: true,
    data: {
      id: campaign.id,
      subject: campaign.subject,
      recipientCount: campaign.recipientCount,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      skippedCount: campaign.skippedCount,
      createdAt: campaign.createdAt.toISOString(),
      recipients: campaign.recipients.map((recipient) => ({
        id: recipient.id,
        emailAddress: recipient.emailAddress,
        status: recipient.status,
        errorMessage: recipient.errorMessage,
        sentAt: recipient.sentAt?.toISOString() ?? null,
      })),
    },
  }
}

export type MarketingRetryResult = { success: true; data: { retriedCount: number } } | { success: false; error: string }

/**
 * Re-sends only recipients currently FAILED on this campaign, resetting them
 * to PENDING and re-running the queue — never touches a row already SENT or
 * SKIPPED_UNSUBSCRIBED, and updates this same campaign's rows rather than
 * creating a new one.
 */
export async function retryFailedMarketingRecipientsAction(campaignId: string): Promise<MarketingRetryResult> {
  await requireAdminSession()

  if (!checkRateLimit(await ipKey('training-marketing-retry'), RETRY_RATE_LIMIT, RETRY_RATE_WINDOW_MS)) {
    return { success: false, error: 'Too many retry attempts recently. Try again later.' }
  }

  const campaign = await prisma.marketingCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return { success: false, error: 'Campaign not found.' }

  const failed = await prisma.marketingCampaignRecipient.findMany({
    where: { campaignId, status: 'FAILED' },
    select: { id: true },
  })
  if (failed.length === 0) return { success: true, data: { retriedCount: 0 } }

  await prisma.$transaction([
    prisma.marketingCampaignRecipient.updateMany({
      where: { id: { in: failed.map((row) => row.id) } },
      data: { status: 'PENDING', errorMessage: null },
    }),
    prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { failedCount: { decrement: failed.length } },
    }),
  ])

  await writeAuditLog({
    action: 'MARKETING_CAMPAIGN_RETRY',
    entityType: 'MarketingCampaign',
    entityId: campaignId,
    afterJson: { retriedCount: failed.length },
  })

  runAfterResponse(() => processMarketingCampaignSend(campaignId))

  return { success: true, data: { retriedCount: failed.length } }
}

const testMarketingEmailInputSchema = z.object({
  criteria: subscriberCriteriaInputSchema,
  content: contentSchema,
  testAddress: z.string().trim().min(1, 'Enter an email address.').email('Enter a valid email address.'),
})

export type MarketingTestSendResult = { success: true; data: { messageId: string } } | { success: false; error: string; fieldErrors?: Record<string, string> }

/**
 * Sends exactly one message, rendered from a real subscriber's resolved
 * values, to an address the administrator types. Creates no
 * MarketingCampaign or MarketingCampaignRecipient row and does not count as
 * a send against any subscriber — this is a formatting check, not part of
 * the audited send trail.
 */
export async function sendTestMarketingEmailAction(input: {
  criteria: SubscriberCriteriaInput
  content: { subject: string; body: string }
  testAddress: string
}): Promise<MarketingTestSendResult> {
  await requireAdminSession()

  if (!checkRateLimit(await ipKey('training-marketing-test'), TEST_RATE_LIMIT, TEST_RATE_WINDOW_MS)) {
    return { success: false, error: 'Too many test sends recently. Try again shortly.' }
  }

  const parsed = testMarketingEmailInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  const recipients = await resolveMarketingRecipients(toSubscriberCriteria(parsed.data.criteria))
  const example = recipients[0]
  if (!example) {
    return { success: false, error: 'No subscribed contacts match this selection yet — a test send needs at least one real recipient to resolve tokens from.' }
  }

  const values = toMarketingPersonalizationValues({ firstName: example.firstName, fullName: example.fullName, schoolName: example.schoolName })
  const unsubscribeUrl = buildUnsubscribeUrl(getSiteUrl(), example.unsubscribeToken)
  const footer = { unsubscribeUrl, contactEmail: EDUGISTICS_CONTACT_EMAIL }
  const rendered = renderMarketingEmail(parsed.data.content.subject, parsed.data.content.body, values, footer)
  const messageHeaders = buildListUnsubscribeHeaders(unsubscribeUrl, EDUGISTICS_CONTACT_EMAIL)

  try {
    const messageId = await dispatchTestMarketingEmail(parsed.data.testAddress, rendered, messageHeaders)
    return { success: true, data: { messageId } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send test email.' }
  }
}
