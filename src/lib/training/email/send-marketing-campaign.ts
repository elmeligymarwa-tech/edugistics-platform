import 'server-only'

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

/** Configurable so operators can raise it if their Resend plan allows — see spec section 2 ("configurable maximum recipients per campaign", default 1000). */
export function getMaxMarketingRecipientsPerCampaign(): number {
  const raw = process.env.MARKETING_EMAIL_MAX_RECIPIENTS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_RECIPIENTS
}

/** Independent of the transactional bulk-email throttle (EMAIL_SEND_RATE_PER_SECOND) so the two campaign types can be tuned separately even though they share the same Resend account quota. */
function getSendIntervalMs(): number {
  const raw = process.env.MARKETING_EMAIL_SEND_RATE_PER_SECOND
  const parsed = raw ? Number(raw) : NaN
  const rate = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEND_RATE_PER_SECOND
  return Math.ceil(1000 / rate)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface DispatchOutcome {
  ok: boolean
  messageId?: string
  error?: string
}

/**
 * One recipient, one message, one `to` address — never cc, bcc or multiple
 * addresses. Always sent from MARKETING_EMAIL_FROM (the news.edugistics.online
 * domain), never the transactional EMAIL_FROM. Resend's own idempotencyKey
 * (the recipient row's id) is passed so a stray duplicate dispatch of the
 * same row is deduplicated by the provider too. On a rate_limit_exceeded
 * response this backs off and retries the same recipient rather than
 * treating it as a failure; other errors are returned immediately so the
 * caller can record FAILED and move on without blocking the queue.
 */
async function dispatchWithBackoff(
  recipientRowId: string,
  to: string,
  content: { subject: string; html: string; text: string },
  headers: Record<string, string>,
): Promise<DispatchOutcome> {
  const resend = getResendClient()

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const { data, error } = await resend.emails.send(
      {
        from: getMarketingEmailFrom(),
        to,
        subject: content.subject,
        html: content.html,
        text: content.text,
        headers,
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

/** SENT is the only outcome that counts toward a subscriber's own send history — marketingEmailsSent/lastMarketingEmailAt update on a successful send only, never on FAILED or SKIPPED_UNSUBSCRIBED. */
async function recordSent(campaignId: string, recipientId: string, subscriberId: string, messageId: string): Promise<void> {
  const now = new Date()
  await prisma.$transaction([
    prisma.marketingCampaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'SENT', sentAt: now, providerMessageId: messageId, errorMessage: null },
    }),
    prisma.marketingCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } }),
    prisma.subscriber.update({ where: { id: subscriberId }, data: { marketingEmailsSent: { increment: 1 }, lastMarketingEmailAt: now } }),
  ])
}

async function recordFailed(campaignId: string, recipientId: string, errorMessage: string): Promise<void> {
  await prisma.$transaction([
    prisma.marketingCampaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'FAILED', errorMessage },
    }),
    prisma.marketingCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
  ])
}

/** Not a failure — the recipient asked to stop hearing from us, most likely during the window this very campaign was sending. Counted and shown separately so the administrator never mistakes it for a delivery problem. */
async function recordSkipped(campaignId: string, recipientId: string): Promise<void> {
  await prisma.$transaction([
    prisma.marketingCampaignRecipient.update({ where: { id: recipientId }, data: { status: 'SKIPPED_UNSUBSCRIBED' } }),
    prisma.marketingCampaign.update({ where: { id: campaignId }, data: { skippedCount: { increment: 1 } } }),
  ])
}

/**
 * Sends every PENDING recipient of a campaign, one at a time, spaced to
 * respect the provider's rate limit. For each row, the subscriber is
 * re-fetched fresh from the database immediately before that individual send
 * — never from a snapshot taken when the campaign was created or from the
 * top of this loop — so a subscriber who unsubscribes during the minutes a
 * large campaign takes to send is skipped rather than emailed. Name, email
 * and unsubscribe token are re-resolved from that same fresh row too, so a
 * teacher who updates their details between queueing and dispatch is
 * addressed correctly.
 *
 * A failed send never stops the queue — every remaining recipient is still
 * attempted. Meant to run inside runAfterResponse so it continues even after
 * the administrator's browser tab is closed.
 */
export async function processMarketingCampaignSend(campaignId: string): Promise<void> {
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return

  const pending = await prisma.marketingCampaignRecipient.findMany({
    where: { campaignId, status: 'PENDING' },
    select: { id: true, subscriberId: true },
  })
  if (pending.length === 0) return

  const intervalMs = getSendIntervalMs()
  const siteUrl = getSiteUrl()

  for (const row of pending) {
    const subscriber = await prisma.subscriber.findUnique({
      where: { id: row.subscriberId },
      include: { teacher: true },
    })

    if (!subscriber || subscriber.status !== 'SUBSCRIBED') {
      await recordSkipped(campaignId, row.id)
      await delay(intervalMs)
      continue
    }

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

    const outcome = await dispatchWithBackoff(row.id, email, content, headers)

    if (outcome.ok && outcome.messageId) {
      await recordSent(campaignId, row.id, subscriber.id, outcome.messageId)
    } else {
      await recordFailed(campaignId, row.id, outcome.error ?? 'Unknown error from the email provider.')
    }

    await delay(intervalMs)
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
