import 'server-only'

import type { Prisma } from '@prisma/client'
import type { CampaignEmailType } from '@/domain/training/schema'
import { prisma } from '../prisma'
import { BATCH_SIZE, TIME_BUDGET_MS, dispatchBatch, type BatchRecipient } from './batch-send'
import { renderCampaignEmail } from './campaign-render'
import { resolveRecipients, toPersonalizationValues, type ResolvedRecipient } from './recipients'
import { getEmailFrom, getEmailReplyTo, getResendClient } from './resend-client'

const DEFAULT_MAX_RECIPIENTS = 500
const DEFAULT_SEND_RATE_PER_SECOND = 2
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Configurable so operators can raise it if their Resend plan allows — see spec section 7 ("configurable maximum recipients per campaign"). */
export function getMaxRecipientsPerCampaign(): number {
  const raw = process.env.BULK_EMAIL_MAX_RECIPIENTS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_RECIPIENTS
}

/**
 * Throttles batch API calls, not individual emails — one call now carries up
 * to BATCH_SIZE recipients, so the same EMAIL_SEND_RATE_PER_SECOND setting
 * that used to space out individual sends now spaces out batches instead.
 * Independent of the marketing-campaign throttle
 * (MARKETING_EMAIL_SEND_RATE_PER_SECOND) even though both share the same
 * Resend account quota.
 */
function getBatchIntervalMs(): number {
  const raw = process.env.EMAIL_SEND_RATE_PER_SECOND
  const parsed = raw ? Number(raw) : NaN
  const rate = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEND_RATE_PER_SECOND
  return Math.ceil(1000 / rate)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Teachers among `recipients` who already received `emailType` for their
 * resolved course within the last 24 hours. Matched by (teacherId, courseId)
 * against past SENT recipient rows joined through their own registration —
 * not the campaign's single courseId field, which is null for a selection
 * spanning multiple courses. This is what makes the duplicate check correct
 * even when one campaign targets several courses at once.
 */
export async function findRecentDuplicateTeacherIds(
  recipients: ResolvedRecipient[],
  emailType: CampaignEmailType,
): Promise<Set<string>> {
  if (recipients.length === 0) return new Set()

  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS)
  const teacherIds = [...new Set(recipients.map((r) => r.teacherId))]

  const rows = await prisma.emailCampaignRecipient.findMany({
    where: {
      status: 'SENT',
      sentAt: { gte: since },
      teacherId: { in: teacherIds },
      campaign: { emailType },
    },
    select: { teacherId: true, registration: { select: { courseId: true } } },
  })

  const sentPairs = new Set(rows.map((row) => `${row.teacherId}:${row.registration.courseId}`))

  const duplicateTeacherIds = new Set<string>()
  for (const recipient of recipients) {
    if (sentPairs.has(`${recipient.teacherId}:${recipient.courseId}`)) duplicateTeacherIds.add(recipient.teacherId)
  }
  return duplicateTeacherIds
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const QUEUE_ABORTED_PREFIX = 'Sending queue aborted before this recipient could be attempted'

/**
 * The queue's last line of defence: whatever is still PENDING when
 * `processCampaignSend` itself throws (not an individual batch — see the
 * per-batch try/catch below) is marked FAILED with a reason, so the
 * administrator sees an explanation instead of a campaign frozen at zero
 * forever. This is what closes the exact gap that orphaned two production
 * marketing campaigns: a config error thrown before any Resend call left
 * every recipient stuck at PENDING with no record of why.
 */
async function failAllRemainingPending(campaignId: string, reason: string): Promise<void> {
  const remaining = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId, status: 'PENDING' },
    select: { id: true },
  })
  if (remaining.length === 0) return

  await prisma.$transaction([
    prisma.emailCampaignRecipient.updateMany({
      where: { id: { in: remaining.map((row) => row.id) } },
      data: { status: 'FAILED', errorMessage: reason },
    }),
    prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: remaining.length } },
    }),
  ])
}

/**
 * Persists every outcome from one batch (sent and failed) in a single
 * transaction — one round trip regardless of batch size. `providerMessageId`
 * and `errorMessage` differ per recipient so those rows are updated
 * individually within the transaction; the campaign's own sentCount/
 * failedCount are uniform per group, so that's a single update statement
 * covering the whole group.
 */
async function recordBatchOutcomes(
  campaignId: string,
  sent: { recipientId: string; messageId: string }[],
  failed: { recipientId: string; error: string }[],
): Promise<void> {
  if (sent.length === 0 && failed.length === 0) return

  const now = new Date()
  const statements: Prisma.PrismaPromise<unknown>[] = [
    ...sent.map((s) =>
      prisma.emailCampaignRecipient.update({
        where: { id: s.recipientId },
        data: { status: 'SENT', sentAt: now, providerMessageId: s.messageId, errorMessage: null },
      }),
    ),
    ...failed.map((f) =>
      prisma.emailCampaignRecipient.update({
        where: { id: f.recipientId },
        data: { status: 'FAILED', errorMessage: f.error },
      }),
    ),
  ]

  statements.push(
    prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { sentCount: { increment: sent.length }, failedCount: { increment: failed.length } },
    }),
  )

  await prisma.$transaction(statements)
}

/**
 * Builds and sends one batch (up to BATCH_SIZE rows) via the shared
 * dispatchBatch (batch-send.ts), then persists every outcome. Recipients are
 * re-resolved fresh from the database immediately before this batch is
 * built — never from a snapshot taken when the campaign was created — so a
 * registration cancelled between queueing and dispatch is caught and failed
 * rather than emailed. includeWaitlisted is always true at this stage: the
 * recipient set itself was already fixed to specific registration ids when
 * the manifest was written, so this only needs to exclude a registration
 * that has since been cancelled — a still-waitlisted registration that was
 * intentionally included stays included.
 */
async function processOneBatch(
  campaign: { id: string; subject: string; bodyTemplate: string },
  pending: { id: string; registrationId: string }[],
): Promise<void> {
  const resolution = await resolveRecipients({
    mode: 'ids',
    registrationIds: pending.map((row) => row.registrationId),
    includeWaitlisted: true,
  })
  const byRegistrationId = new Map(resolution.recipients.map((recipient) => [recipient.registrationId, recipient]))

  const toSend: BatchRecipient[] = []
  const failedBeforeDispatch: { recipientId: string; error: string }[] = []

  for (const row of pending) {
    const resolved = byRegistrationId.get(row.registrationId)
    if (!resolved) {
      failedBeforeDispatch.push({
        recipientId: row.id,
        error: 'This registration is no longer active — the teacher may have cancelled since the campaign was queued.',
      })
      continue
    }

    try {
      const content = renderCampaignEmail(campaign.subject, campaign.bodyTemplate, toPersonalizationValues(resolved))
      toSend.push({
        recipientId: row.id,
        email: {
          from: getEmailFrom(),
          to: resolved.email,
          replyTo: getEmailReplyTo(),
          subject: content.subject,
          html: content.html,
          text: content.text,
        },
      })
    } catch (error) {
      failedBeforeDispatch.push({ recipientId: row.id, error: describeError(error) })
    }
  }

  const outcomes = await dispatchBatch(toSend)
  const sent = outcomes.filter((o) => o.ok).map((o) => ({ recipientId: o.recipientId, messageId: o.messageId! }))
  const failed = [
    ...failedBeforeDispatch,
    ...outcomes.filter((o) => !o.ok).map((o) => ({ recipientId: o.recipientId, error: o.error ?? 'Unknown error from the email provider.' })),
  ]

  await recordBatchOutcomes(campaign.id, sent, failed)
}

/**
 * Sends every PENDING recipient of a campaign, in batches of up to
 * BATCH_SIZE via Resend's batch endpoint (see dispatchBatch in
 * batch-send.ts), spaced to respect the provider's rate limit. Meant to run
 * inside runAfterResponse so it continues even after the admin's request has
 * returned.
 *
 * Same defect-1 fix applied to this, the other bulk sender that shared its
 * one-call-per-recipient architecture: this used to make one Resend API
 * call per recipient inside a single serverless invocation extended past
 * the response via Next's after(), with no `maxDuration` configured
 * anywhere in this codebase — so a large course campaign (up to
 * getMaxRecipientsPerCampaign(), 500 by default) was exposed to exactly the
 * same platform-timeout cliff that stalled marketing campaigns around ~268
 * recipients. Batching cuts the recipient-count-to-API-call ratio roughly
 * 50x, and voluntarily checkpointing at TIME_BUDGET_MS (see batch-send.ts)
 * means this never depends on what the platform's actual timeout is.
 *
 * Safe to call again for the same campaign at any time: it only ever looks
 * at rows still PENDING, so anything already SENT is never re-sent.
 *
 * Two layers of failure isolation, both required: a problem specific to one
 * batch (a bad row, a rendering bug, dispatchBatch itself throwing) must not
 * stop the batches behind it — the per-batch try/catch below marks that
 * batch's rows FAILED and moves on. A problem that has nothing to do with
 * any single batch (the initial campaign lookup, or a database write itself
 * failing) would otherwise escape the loop entirely and leave every row it
 * never reached silently PENDING forever — the outer try/catch sweeps every
 * row still PENDING into FAILED with a clear reason the moment that happens.
 */
export async function processCampaignSend(campaignId: string): Promise<void> {
  const startedAt = Date.now()
  try {
    const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } })
    if (!campaign) return

    const batchIntervalMs = getBatchIntervalMs()
    let isFirstBatch = true

    for (;;) {
      const pending = await prisma.emailCampaignRecipient.findMany({
        where: { campaignId, status: 'PENDING' },
        select: { id: true, registrationId: true },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      })
      if (pending.length === 0) return

      if (!isFirstBatch) await delay(batchIntervalMs)
      isFirstBatch = false

      try {
        await processOneBatch(campaign, pending)
      } catch (error) {
        // A batch-level failure (not an individual recipient) — mark this
        // batch's rows FAILED and move on to the next one rather than
        // letting the whole queue die here.
        const reason = describeError(error)
        await prisma.$transaction([
          prisma.emailCampaignRecipient.updateMany({
            where: { id: { in: pending.map((row) => row.id) } },
            data: { status: 'FAILED', errorMessage: reason },
          }),
          prisma.emailCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: pending.length } } }),
        ])
      }

      if (Date.now() - startedAt >= TIME_BUDGET_MS) return
    }
  } catch (error) {
    const reason = `${QUEUE_ABORTED_PREFIX}: ${describeError(error)}`
    await failAllRemainingPending(campaignId, reason).catch((sweepError) => {
      console.error(`[bulk-campaign] failed to mark remaining recipients FAILED after queue abort for campaign ${campaignId}`, sweepError)
    })
    console.error(`[bulk-campaign] sending queue aborted for campaign ${campaignId}`, error)
  }
}

export class EmailSendError extends Error {
  constructor(cause: string) {
    super(`Failed to send email: ${cause}`)
    this.name = 'EmailSendError'
  }
}

/** A single, immediate send outside the campaign machinery — used for "Send Test to Myself" only. Never touches EmailCampaign/EmailCampaignRecipient. */
export async function dispatchTestEmail(to: string, content: { subject: string; html: string; text: string }): Promise<string> {
  const resend = getResendClient()
  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to,
    replyTo: getEmailReplyTo(),
    subject: content.subject,
    html: content.html,
    text: content.text,
  })

  if (error || !data) {
    throw new EmailSendError(error?.message ?? 'Unknown error')
  }

  return data.id
}
