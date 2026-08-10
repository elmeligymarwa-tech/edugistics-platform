import 'server-only'

import type { CampaignEmailType } from '@/domain/training/schema'
import { prisma } from '../prisma'
import { renderCampaignEmail } from './campaign-render'
import { resolveRecipients, toPersonalizationValues, type ResolvedRecipient } from './recipients'
import { getEmailFrom, getEmailReplyTo, getResendClient } from './resend-client'

const DEFAULT_MAX_RECIPIENTS = 500
const DEFAULT_SEND_RATE_PER_SECOND = 2
const MAX_RATE_LIMIT_RETRIES = 5
const RATE_LIMIT_BASE_BACKOFF_MS = 1000
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Configurable so operators can raise it if their Resend plan allows — see spec section 7 ("configurable maximum recipients per campaign"). */
export function getMaxRecipientsPerCampaign(): number {
  const raw = process.env.BULK_EMAIL_MAX_RECIPIENTS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_RECIPIENTS
}

/** Conservative default matching Resend's base-plan limit; raise via env for a higher-tier plan. */
function getSendIntervalMs(): number {
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

interface DispatchOutcome {
  ok: boolean
  messageId?: string
  error?: string
}

/**
 * One recipient, one message, one `to` address — never cc, bcc or multiple
 * addresses. Resend's own idempotencyKey (the recipient row's id) is passed
 * so a stray duplicate dispatch of the same row is deduplicated by the
 * provider too, not just by our own PENDING/SENT bookkeeping. On a
 * rate_limit_exceeded response this backs off and retries the same
 * recipient rather than treating it as a failure; other errors are returned
 * immediately so the caller can record FAILED and move on to the next
 * recipient without blocking the queue.
 */
async function dispatchWithBackoff(
  recipientRowId: string,
  to: string,
  content: { subject: string; html: string; text: string },
): Promise<DispatchOutcome> {
  const resend = getResendClient()

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const { data, error } = await resend.emails.send(
      {
        from: getEmailFrom(),
        to,
        replyTo: getEmailReplyTo(),
        subject: content.subject,
        html: content.html,
        text: content.text,
      },
      { idempotencyKey: recipientRowId },
    )

    if (!error && data) return { ok: true, messageId: data.id }

    const isRateLimited = error?.name === 'rate_limit_exceeded'
    if (isRateLimited && attempt < MAX_RATE_LIMIT_RETRIES) {
      await delay(RATE_LIMIT_BASE_BACKOFF_MS * 2 ** attempt)
      continue
    }

    return { ok: false, error: error?.message ?? 'Unknown error from the email provider.' }
  }

  return { ok: false, error: 'Rate limited by the email provider after repeated retries.' }
}

async function recordSent(campaignId: string, recipientId: string, messageId: string): Promise<void> {
  await prisma.$transaction([
    prisma.emailCampaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'SENT', sentAt: new Date(), providerMessageId: messageId, errorMessage: null },
    }),
    prisma.emailCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } }),
  ])
}

async function recordFailed(campaignId: string, recipientId: string, errorMessage: string): Promise<void> {
  await prisma.$transaction([
    prisma.emailCampaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'FAILED', errorMessage },
    }),
    prisma.emailCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
  ])
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const QUEUE_ABORTED_PREFIX = 'Sending queue aborted before this recipient could be attempted'

/**
 * The queue's last line of defence: whatever is still PENDING when
 * `processCampaignSend` itself throws (not an individual recipient — see the
 * per-recipient try/catch below, which handles that case without ever
 * reaching here) is marked FAILED with a reason, so the administrator sees
 * an explanation instead of a campaign frozen at zero forever. This is what
 * closes the exact gap that orphaned two production marketing campaigns: a
 * config error thrown before any Resend call left every recipient stuck at
 * PENDING with no record of why.
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
 * Sends every PENDING recipient of a campaign, one at a time, spaced to
 * respect the provider's rate limit. Recipients are re-resolved fresh from
 * the database here (not from any snapshot taken when the campaign was
 * created) so a registration cancelled between queueing and dispatch is
 * caught and failed rather than emailed. includeWaitlisted is always true at
 * this stage: the recipient set itself was already fixed to specific
 * registration ids when the manifest was written, so this only needs to
 * exclude a registration that has since been cancelled — a still-waitlisted
 * registration that was intentionally included stays included.
 *
 * A failed send never stops the queue — every remaining recipient is still
 * attempted. Meant to run inside runAfterResponse so it continues even after
 * the admin's request has returned.
 *
 * Two layers of failure isolation, both required: an exception specific to
 * one recipient (a bad row, a rendering bug, dispatchWithBackoff throwing
 * instead of returning an outcome) must not stop the recipients behind it —
 * the inner try/catch marks that one row FAILED and moves on. An exception
 * that has nothing to do with any single recipient (the initial queries
 * above, or a database write itself failing inside the inner catch) would
 * otherwise escape the loop entirely and leave every row it never reached
 * silently PENDING forever — the outer try/catch is what used to be
 * missing, and is what now sweeps every row still PENDING into FAILED with
 * a clear reason the moment that happens.
 */
export async function processCampaignSend(campaignId: string): Promise<void> {
  try {
    const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } })
    if (!campaign) return

    const pending = await prisma.emailCampaignRecipient.findMany({
      where: { campaignId, status: 'PENDING' },
      select: { id: true, registrationId: true },
    })
    if (pending.length === 0) return

    const resolution = await resolveRecipients({
      mode: 'ids',
      registrationIds: pending.map((row) => row.registrationId),
      includeWaitlisted: true,
    })
    const byRegistrationId = new Map(resolution.recipients.map((recipient) => [recipient.registrationId, recipient]))

    const intervalMs = getSendIntervalMs()

    for (const row of pending) {
      try {
        const resolved = byRegistrationId.get(row.registrationId)

        if (!resolved) {
          await recordFailed(campaignId, row.id, 'This registration is no longer active — the teacher may have cancelled since the campaign was queued.')
        } else {
          const content = renderCampaignEmail(campaign.subject, campaign.bodyTemplate, toPersonalizationValues(resolved))
          const outcome = await dispatchWithBackoff(row.id, resolved.email, content)

          if (outcome.ok && outcome.messageId) {
            await recordSent(campaignId, row.id, outcome.messageId)
          } else {
            await recordFailed(campaignId, row.id, outcome.error ?? 'Unknown error from the email provider.')
          }
        }
      } catch (error) {
        // Deliberately not caught-and-swallowed: if recordFailed itself is
        // what threw (e.g. the database is unreachable), this rethrows out
        // to the outer catch below, which sweeps this row up too rather
        // than silently leaving it PENDING.
        await recordFailed(campaignId, row.id, describeError(error))
      }

      await delay(intervalMs)
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
