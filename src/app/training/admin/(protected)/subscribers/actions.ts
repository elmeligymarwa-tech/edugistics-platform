'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { writeAuditLog } from '@/lib/training/audit-log'
import { prisma } from '@/lib/training/prisma'
import {
  RESUBSCRIBE_CONFIRMATION_WORD,
  subscriberCriteriaInputSchema,
  toSubscriberCriteria,
  type SubscriberCriteriaInput,
} from '@/lib/training/subscriber-criteria'
import { resolveSubscriberSelection } from '@/lib/training/subscribers-admin'

export type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string }

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
