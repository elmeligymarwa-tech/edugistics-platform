'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'

import { EDUGISTICS_CONTACT_EMAIL } from '@/domain/training/contact'
import { toMarketingPersonalizationValues } from '@/domain/training/personalization'
import { writeAuditLog } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { contentSchema } from '@/lib/training/email/criteria'
import { renderMarketingEmail } from '@/lib/training/email/marketing-render'
import { renderCampaignBodyHtml } from '@/lib/training/email/rich-text'
import { prisma } from '@/lib/training/prisma'
import { getSiteUrl } from '@/lib/training/site-url'
import {
  RESUBSCRIBE_CONFIRMATION_WORD,
  subscriberCriteriaInputSchema,
  toSubscriberCriteria,
  type SubscriberCriteriaInput,
} from '@/lib/training/subscriber-criteria'
import { resolveMarketingRecipients, resolveSubscriberSelection } from '@/lib/training/subscribers-admin'
import { buildUnsubscribeUrl } from '@/lib/training/unsubscribe'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> }

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

function revalidateSubscribers(id?: string) {
  revalidatePath('/training/admin/subscribers')
  if (id) revalidatePath(`/training/admin/subscribers/${id}`)
}

export interface SubscriberSelectionSummary {
  count: number
}

/** Selected-count for the persistent action bar — re-resolves server-side via resolveSubscriberSelection, so the count shown always matches who would actually receive mail. */
export async function getSubscriberSelectionSummaryAction(input: SubscriberCriteriaInput): Promise<ActionResult<SubscriberSelectionSummary>> {
  await requireAdminSession()

  const parsed = subscriberCriteriaInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid selection.' }

  const resolution = await resolveSubscriberSelection(toSubscriberCriteria(parsed.data))
  return { success: true, data: { count: resolution.count } }
}

/** Simple confirmation — an administrator unsubscribing someone after a phone/email request. Always writes a ConsentEvent; never a silent status change. */
export async function manualUnsubscribeAction(subscriberId: string): Promise<ActionResult> {
  await requireAdminSession()

  const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } })
  if (!subscriber) return { success: false, error: 'Subscriber not found.' }
  if (subscriber.status === 'UNSUBSCRIBED') return { success: false, error: 'This contact is already unsubscribed.' }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.subscriber.update({
      where: { id: subscriberId },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: now, statusChangedBy: 'ADMIN' },
    })
    await tx.consentEvent.create({
      data: { subscriberId, eventType: 'UNSUBSCRIBED', source: 'ADMIN_MANUAL', occurredAt: now },
    })
  })

  await writeAuditLog({
    action: 'SUBSCRIBER_UNSUBSCRIBED_MANUALLY',
    entityType: 'Subscriber',
    entityId: subscriberId,
    beforeJson: { status: subscriber.status },
    afterJson: { status: 'UNSUBSCRIBED' },
  })

  revalidateSubscribers(subscriberId)
  return { success: true, data: undefined }
}

/**
 * Stronger confirmation than unsubscribe: the administrator must type
 * RESUBSCRIBE, re-checked here server-side (never trust the dialog alone —
 * a client that skips the UI must still be rejected). Only for the rare
 * case a teacher explicitly asks to be put back on the list; the dialog
 * text says so.
 */
export async function manualResubscribeAction(subscriberId: string, typedConfirmation: string): Promise<ActionResult> {
  await requireAdminSession()

  if (typedConfirmation !== RESUBSCRIBE_CONFIRMATION_WORD) {
    return { success: false, error: `Type ${RESUBSCRIBE_CONFIRMATION_WORD} to confirm.` }
  }

  const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } })
  if (!subscriber) return { success: false, error: 'Subscriber not found.' }
  if (subscriber.status === 'SUBSCRIBED') return { success: false, error: 'This contact is already subscribed.' }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.subscriber.update({
      where: { id: subscriberId },
      data: {
        status: 'SUBSCRIBED',
        subscribedAt: now,
        unsubscribedAt: null,
        consentSource: 'ADMIN_MANUAL',
        statusChangedBy: 'ADMIN',
      },
    })
    await tx.consentEvent.create({
      data: { subscriberId, eventType: 'RESUBSCRIBED', source: 'ADMIN_MANUAL', occurredAt: now },
    })
  })

  await writeAuditLog({
    action: 'SUBSCRIBER_RESUBSCRIBED_MANUALLY',
    entityType: 'Subscriber',
    entityId: subscriberId,
    beforeJson: { status: subscriber.status },
    afterJson: { status: 'SUBSCRIBED' },
  })

  revalidateSubscribers(subscriberId)
  return { success: true, data: undefined }
}

export interface MarketingEmailPreview {
  recipientCount: number
  /** The body rendered through the markdown-lite formatter with tokens still visible (not personalised) — lets the administrator review the structure they authored. */
  renderedBodyHtml: string
  example: {
    recipientName: string
    subject: string
    html: string
    text: string
  }
}

/**
 * Builds the composer's preview: recipient count (already subscribed-only,
 * via resolveMarketingRecipients), the body rendered with tokens still
 * visible, and one fully personalised example — including the mandatory
 * unsubscribe footer with that recipient's own real token — rendered from a
 * real recipient's own data. Never sends anything; there is no sending
 * engine in this phase.
 */
export async function previewMarketingEmailAction(
  criteriaInput: SubscriberCriteriaInput,
  content: { subject: string; body: string },
): Promise<ActionResult<MarketingEmailPreview>> {
  await requireAdminSession()

  const parsedCriteria = subscriberCriteriaInputSchema.safeParse(criteriaInput)
  if (!parsedCriteria.success) return { success: false, error: 'Invalid selection.' }

  const parsedContent = contentSchema.safeParse(content)
  if (!parsedContent.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsedContent.error) }
  }

  const recipients = await resolveMarketingRecipients(toSubscriberCriteria(parsedCriteria.data))
  const example = recipients[0]
  if (!example) {
    return { success: false, error: 'No subscribed contacts match this selection.' }
  }

  const footer = {
    unsubscribeUrl: buildUnsubscribeUrl(getSiteUrl(), example.unsubscribeToken),
    contactEmail: EDUGISTICS_CONTACT_EMAIL,
  }
  const values = toMarketingPersonalizationValues({ firstName: example.firstName, fullName: example.fullName, schoolName: example.schoolName })
  const rendered = renderMarketingEmail(parsedContent.data.subject, parsedContent.data.body, values, footer)

  return {
    success: true,
    data: {
      recipientCount: recipients.length,
      renderedBodyHtml: renderCampaignBodyHtml(parsedContent.data.body),
      example: {
        recipientName: example.fullName,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
    },
  }
}
