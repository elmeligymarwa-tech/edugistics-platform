import 'server-only'

import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'
import type { CreateBatchEmailOptions } from 'resend'
import { EDUGISTICS_CONTACT_EMAIL } from '@/domain/training/contact'
import { deriveFirstName, toMarketingPersonalizationValues } from '@/domain/training/personalization'
import { prisma } from '../prisma'
import { resolveDisplayEmail, resolveDisplayName } from '../subscribers-admin'
import { getSiteUrl } from '../site-url'
import { buildUnsubscribeUrl } from '../unsubscribe'
import { buildListUnsubscribeHeaders } from './marketing-headers'
import { renderMarketingEmail } from './marketing-render'
import { getMarketingEmailFrom, getResendClient } from './resend-client'

const DEFAULT_MAX_RECIPIENTS = 1000
const DEFAULT_SEND_RATE_PER_SECOND = 2
const MAX_RATE_LIMIT_RETRIES = 5
const RATE_LIMIT_BASE_BACKOFF_MS = 1000

/**
 * Resend's batch endpoint accepts up to 100 messages per call (see
 * https://resend.com/docs/dashboard/emails/batch-sending). Deliberately half
 * that, not the maximum: if this invocation is killed between Resend
 * accepting a batch and this process writing SENT to those rows, every
 * recipient in that batch is left PENDING and would be re-sent on resume —
 * a real, unavoidable at-least-once-delivery race (see recordBatchOutcomes).
 * A smaller batch bounds how many people that race can affect, in exchange
 * for still cutting the recipient-count-to-API-call ratio roughly 50x
 * against the one-call-per-recipient design that caused defect 1.
 */
const BATCH_SIZE = 50

/**
 * Defect 1: the send loop used to make one Resend API call per recipient,
 * all inside a single serverless invocation extended past the response via
 * Next's after() (see runAfterResponse). At ~268 recipients that invocation
 * was hitting the platform's function timeout mid-loop — with no explicit
 * `maxDuration` anywhere in this codebase, that's whatever the Vercel
 * deployment's own default is, not a number this code controls. When the
 * platform kills an invocation like that, nothing in this file ever runs
 * again for it: no catch block fires, nothing marks the untouched rows —
 * they're simply left PENDING forever, which is what was actually happening
 * to the ~232 recipients past the cutoff (a different mechanism to the
 * MARKETING_EMAIL_FROM incident, which threw before any row was touched and
 * was already caught by the outer try/catch below — this is a hard kill
 * with no JS execution left to catch anything).
 *
 * The fix does not raise maxDuration — that only moves the same cliff to a
 * larger list. Instead this loop self-limits to a conservative time budget,
 * comfortably under even a bare 60s function timeout regardless of what the
 * platform is actually configured to allow, and voluntarily checkpoints
 * (stops cleanly, with every row so far durably recorded) if it's still
 * running when that budget is reached. Recipients still PENDING at that
 * point are exactly as safe as recipients PENDING for any other reason —
 * see retryFailedMarketingRecipientsAction, which already recovers a
 * campaign that's gone quiet.
 */
const TIME_BUDGET_MS = 45_000

/** Configurable so operators can raise it if their Resend plan allows — see spec section 2 ("configurable maximum recipients per campaign", default 1000). */
export function getMaxMarketingRecipientsPerCampaign(): number {
  const raw = process.env.MARKETING_EMAIL_MAX_RECIPIENTS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_RECIPIENTS
}

/**
 * Throttles batch API calls, not individual emails — one call now carries up
 * to BATCH_SIZE recipients, so the same MARKETING_EMAIL_SEND_RATE_PER_SECOND
 * setting that used to space out individual sends now spaces out batches
 * instead. Independent of the transactional bulk-email throttle
 * (EMAIL_SEND_RATE_PER_SECOND) even though both share the same Resend
 * account quota.
 */
function getBatchIntervalMs(): number {
  const raw = process.env.MARKETING_EMAIL_SEND_RATE_PER_SECOND
  const parsed = raw ? Number(raw) : NaN
  const rate = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEND_RATE_PER_SECOND
  return Math.ceil(1000 / rate)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface BatchRecipient {
  recipientId: string
  subscriberId: string
  email: CreateBatchEmailOptions
}

interface BatchOutcome {
  recipientId: string
  subscriberId: string
  ok: boolean
  messageId?: string
  error?: string
}

interface BatchValidationError {
  index: number
  message: string
}

/**
 * Maps Resend's batch response back onto the recipients that were sent, by
 * position. `batchValidation: 'permissive'` means one bad recipient doesn't
 * reject the whole call: Resend returns `errors`, naming the *original*
 * input index of every message it rejected, and `data`, containing one
 * entry per message it *did* accept — in the same relative order as the
 * input, with rejected indices simply absent (not null-padded). So: walk
 * the original list in order; an index present in `errors` failed at that
 * position; every other index consumes the next `data` entry in turn. Pure
 * and DB/network-free by design — see send-marketing-campaign.test.ts.
 */
export function mapBatchResponseToOutcomes(
  recipients: readonly Pick<BatchRecipient, 'recipientId' | 'subscriberId'>[],
  data: readonly { id: string }[],
  errors: readonly BatchValidationError[],
): BatchOutcome[] {
  const errorByIndex = new Map(errors.map((e) => [e.index, e.message]))
  const successes = [...data]
  return recipients.map((recipient, index) => {
    const validationError = errorByIndex.get(index)
    if (validationError) {
      return { recipientId: recipient.recipientId, subscriberId: recipient.subscriberId, ok: false, error: validationError }
    }
    const success = successes.shift()
    if (!success) {
      return {
        recipientId: recipient.recipientId,
        subscriberId: recipient.subscriberId,
        ok: false,
        error: 'Resend returned no result for this recipient.',
      }
    }
    return { recipientId: recipient.recipientId, subscriberId: recipient.subscriberId, ok: true, messageId: success.id }
  })
}

/**
 * One Resend batch call carrying every recipient passed in, with the same
 * rate-limit backoff dispatchWithBackoff used to have — retried as a whole,
 * against the same idempotencyKey, so a transient retry can't double-send
 * a batch Resend actually already accepted. A batch that fails outright
 * after retries (rather than a per-recipient validation error) fails every
 * recipient in it with the same reason — indistinguishable at that point,
 * same as any other network failure.
 */
async function dispatchBatch(recipients: BatchRecipient[]): Promise<BatchOutcome[]> {
  if (recipients.length === 0) return []

  const resend = getResendClient()
  const idempotencyKey = randomUUID()
  const payload = recipients.map((r) => r.email)

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const { data, error } = await resend.batch.send(payload, { idempotencyKey, batchValidation: 'permissive' })

    if (!error && data) {
      const errors = 'errors' in data && Array.isArray(data.errors) ? (data.errors as BatchValidationError[]) : []
      return mapBatchResponseToOutcomes(recipients, data.data, errors)
    }

    const isRateLimited = error?.name === 'rate_limit_exceeded'
    if (isRateLimited && attempt < MAX_RATE_LIMIT_RETRIES) {
      await delay(RATE_LIMIT_BASE_BACKOFF_MS * 2 ** attempt)
      continue
    }

    const reason = error?.message ?? 'Unknown error from the email provider.'
    return recipients.map((r) => ({ recipientId: r.recipientId, subscriberId: r.subscriberId, ok: false, error: reason }))
  }

  const reason = 'Rate limited by the email provider after repeated retries.'
  return recipients.map((r) => ({ recipientId: r.recipientId, subscriberId: r.subscriberId, ok: false, error: reason }))
}

/**
 * Persists every outcome from one batch (sent, failed, and unsubscribed
 * during this campaign's send) in a single transaction — one round trip
 * regardless of batch size. `providerMessageId` and `errorMessage` differ
 * per recipient so those rows are updated individually within the
 * transaction; the campaign's own counters and a SENT subscriber's
 * marketingEmailsSent/lastMarketingEmailAt are uniform per group, so those
 * are each a single updateMany/update statement covering the whole group.
 */
async function recordBatchOutcomes(
  campaignId: string,
  sent: { recipientId: string; subscriberId: string; messageId: string }[],
  failed: { recipientId: string; error: string }[],
  skipped: { recipientId: string }[],
): Promise<void> {
  if (sent.length === 0 && failed.length === 0 && skipped.length === 0) return

  const now = new Date()
  const statements: Prisma.PrismaPromise<unknown>[] = [
    ...sent.map((s) =>
      prisma.marketingCampaignRecipient.update({
        where: { id: s.recipientId },
        data: { status: 'SENT', sentAt: now, providerMessageId: s.messageId, errorMessage: null },
      }),
    ),
    ...failed.map((f) =>
      prisma.marketingCampaignRecipient.update({
        where: { id: f.recipientId },
        data: { status: 'FAILED', errorMessage: f.error },
      }),
    ),
  ]

  if (skipped.length > 0) {
    statements.push(
      prisma.marketingCampaignRecipient.updateMany({
        where: { id: { in: skipped.map((s) => s.recipientId) } },
        data: { status: 'SKIPPED_UNSUBSCRIBED' },
      }),
    )
  }

  if (sent.length > 0 || failed.length > 0 || skipped.length > 0) {
    statements.push(
      prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: sent.length },
          failedCount: { increment: failed.length },
          skippedCount: { increment: skipped.length },
        },
      }),
    )
  }

  if (sent.length > 0) {
    statements.push(
      prisma.subscriber.updateMany({
        where: { id: { in: sent.map((s) => s.subscriberId) } },
        data: { marketingEmailsSent: { increment: 1 }, lastMarketingEmailAt: now },
      }),
    )
  }

  await prisma.$transaction(statements)
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const QUEUE_ABORTED_PREFIX = 'Sending queue aborted before this recipient could be attempted'

/**
 * The queue's last line of defence: whatever is still PENDING when
 * `processMarketingCampaignSend` itself throws (not an individual batch —
 * see the per-batch try/catch below) is marked FAILED with a reason. This is
 * the exact gap that let a misspelled MARKETING_EMAIL_FROM orphan two
 * production campaigns silently: the sender-resolution throw happened
 * before any Resend call and before any row was ever touched, so nothing
 * downstream ever recorded what went wrong.
 */
async function failAllRemainingPending(campaignId: string, reason: string): Promise<void> {
  const remaining = await prisma.marketingCampaignRecipient.findMany({
    where: { campaignId, status: 'PENDING' },
    select: { id: true },
  })
  if (remaining.length === 0) return

  await prisma.$transaction([
    prisma.marketingCampaignRecipient.updateMany({
      where: { id: { in: remaining.map((row) => row.id) } },
      data: { status: 'FAILED', errorMessage: reason },
    }),
    prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: remaining.length } },
    }),
  ])
}

/**
 * Builds and sends one batch (up to BATCH_SIZE rows), then persists every
 * outcome. Each recipient's subscriber is re-fetched fresh immediately
 * before this batch is built — never from a snapshot taken earlier — so a
 * subscriber who unsubscribes while a large campaign is sending is skipped
 * rather than emailed, and a teacher who updates their details between
 * queueing and dispatch is addressed correctly. A recipient whose content
 * fails to render (a bad row, a personalisation bug) is recorded FAILED
 * individually and excluded from the Resend call — it never blocks the rest
 * of the batch.
 */
async function processOneBatch(
  campaign: { id: string; subject: string; bodyTemplate: string },
  pending: { id: string; subscriberId: string }[],
  siteUrl: string,
): Promise<void> {
  const subscribers = await prisma.subscriber.findMany({
    where: { id: { in: pending.map((row) => row.subscriberId) } },
    include: { teacher: true },
  })
  const subscriberById = new Map(subscribers.map((s) => [s.id, s]))

  const toSend: BatchRecipient[] = []
  const skipped: { recipientId: string }[] = []
  const failedBeforeDispatch: { recipientId: string; error: string }[] = []

  for (const row of pending) {
    const subscriber = subscriberById.get(row.subscriberId)
    if (!subscriber || subscriber.status !== 'SUBSCRIBED') {
      skipped.push({ recipientId: row.id })
      continue
    }

    try {
      const fullName = resolveDisplayName(subscriber)
      const email = resolveDisplayEmail(subscriber)
      const values = toMarketingPersonalizationValues({
        firstName: deriveFirstName(fullName),
        fullName,
        schoolName: subscriber.teacher?.schoolNameOriginal ?? '',
      })
      const unsubscribeUrl = buildUnsubscribeUrl(siteUrl, subscriber.unsubscribeToken)
      const footer = { unsubscribeUrl, contactEmail: EDUGISTICS_CONTACT_EMAIL }
      const content = renderMarketingEmail(campaign.subject, campaign.bodyTemplate, values, footer)
      const headers = buildListUnsubscribeHeaders(unsubscribeUrl, EDUGISTICS_CONTACT_EMAIL)

      toSend.push({
        recipientId: row.id,
        subscriberId: subscriber.id,
        email: {
          from: getMarketingEmailFrom(),
          to: email,
          subject: content.subject,
          html: content.html,
          text: content.text,
          headers,
        },
      })
    } catch (error) {
      failedBeforeDispatch.push({ recipientId: row.id, error: describeError(error) })
    }
  }

  const outcomes = await dispatchBatch(toSend)
  const sent = outcomes.filter((o) => o.ok).map((o) => ({ recipientId: o.recipientId, subscriberId: o.subscriberId, messageId: o.messageId! }))
  const failed = [
    ...failedBeforeDispatch,
    ...outcomes.filter((o) => !o.ok).map((o) => ({ recipientId: o.recipientId, error: o.error ?? 'Unknown error from the email provider.' })),
  ]

  await recordBatchOutcomes(campaign.id, sent, failed, skipped)
}

/**
 * Sends every PENDING recipient of a campaign, in batches of up to
 * BATCH_SIZE via Resend's batch endpoint (see dispatchBatch), spaced to
 * respect the provider's rate limit. Meant to run inside runAfterResponse so
 * it continues even after the administrator's browser tab is closed.
 *
 * Voluntarily stops once TIME_BUDGET_MS has elapsed if recipients remain
 * PENDING — see TIME_BUDGET_MS for why. Safe to call again for the same
 * campaign at any time: it only ever looks at rows still PENDING, so
 * anything already SENT is never re-sent (see retryFailedMarketingRecipientsAction,
 * which is what calls this again for a campaign that stopped this way).
 *
 * Two layers of failure isolation, both required: a problem specific to one
 * batch (a bad row, a rendering bug, dispatchBatch itself throwing —
 * including a misconfigured MARKETING_EMAIL_FROM, which throws synchronously
 * before any Resend call) must not stop the batches behind it — the
 * per-batch try/catch below marks that batch's rows FAILED and moves on. A
 * problem that has nothing to do with any single batch (the initial
 * campaign lookup, or a database write itself failing) would otherwise
 * escape the loop entirely and leave every row it never reached silently
 * PENDING forever — the outer try/catch sweeps every row still PENDING into
 * FAILED with a clear reason the moment that happens.
 */
export async function processMarketingCampaignSend(campaignId: string): Promise<void> {
  const startedAt = Date.now()
  try {
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id: campaignId } })
    if (!campaign) return

    const siteUrl = getSiteUrl()
    const batchIntervalMs = getBatchIntervalMs()
    let isFirstBatch = true

    for (;;) {
      const pending = await prisma.marketingCampaignRecipient.findMany({
        where: { campaignId, status: 'PENDING' },
        select: { id: true, subscriberId: true },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      })
      if (pending.length === 0) return

      if (!isFirstBatch) await delay(batchIntervalMs)
      isFirstBatch = false

      try {
        await processOneBatch(campaign, pending, siteUrl)
      } catch (error) {
        // A batch-level failure (not an individual recipient) — mark this
        // batch's rows FAILED and move on to the next one rather than
        // letting the whole queue die here.
        const reason = describeError(error)
        await prisma.$transaction([
          prisma.marketingCampaignRecipient.updateMany({
            where: { id: { in: pending.map((row) => row.id) } },
            data: { status: 'FAILED', errorMessage: reason },
          }),
          prisma.marketingCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: pending.length } } }),
        ])
      }

      if (Date.now() - startedAt >= TIME_BUDGET_MS) return
    }
  } catch (error) {
    const reason = `${QUEUE_ABORTED_PREFIX}: ${describeError(error)}`
    await failAllRemainingPending(campaignId, reason).catch((sweepError) => {
      console.error(`[marketing-campaign] failed to mark remaining recipients FAILED after queue abort for campaign ${campaignId}`, sweepError)
    })
    console.error(`[marketing-campaign] sending queue aborted for campaign ${campaignId}`, error)
  }
}

export class MarketingEmailSendError extends Error {
  constructor(cause: string) {
    super(`Failed to send email: ${cause}`)
    this.name = 'MarketingEmailSendError'
  }
}

/** A single, immediate send outside the campaign machinery — used for "Send Test to Myself" only. Never touches MarketingCampaign/MarketingCampaignRecipient and never counts against any subscriber. */
export async function dispatchTestMarketingEmail(to: string, content: { subject: string; html: string; text: string }, headers: Record<string, string>): Promise<string> {
  const resend = getResendClient()
  const { data, error } = await resend.emails.send({
    from: getMarketingEmailFrom(),
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    headers,
  })

  if (error || !data) {
    throw new MarketingEmailSendError(error?.message ?? 'Unknown error')
  }

  return data.id
}
