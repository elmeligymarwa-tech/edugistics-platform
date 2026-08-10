import 'server-only'

import { prisma } from './prisma'

/** Shows enough of the address to be recognisable without exposing it in full — e.g. "jo***@example.com". */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '***'
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)
  const visibleLength = Math.min(2, local.length)
  const visible = local.slice(0, visibleLength)
  return `${visible}${'*'.repeat(Math.max(local.length - visibleLength, 3))}@${domain}`
}

export interface UnsubscribeTokenInfo {
  maskedEmail: string
  alreadyUnsubscribed: boolean
}

/**
 * Looks up a token for display only — never mutates anything. The
 * unsubscribe page must not act on a token merely because it was loaded
 * (email clients and security scanners pre-fetch links).
 */
export async function resolveUnsubscribeToken(token: string): Promise<UnsubscribeTokenInfo | null> {
  const subscriber = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
    include: { teacher: { select: { emailOriginal: true } } },
  })
  if (!subscriber) return null

  const email = subscriber.teacher?.emailOriginal ?? subscriber.emailOriginal ?? subscriber.emailNormalised
  return { maskedEmail: maskEmail(email), alreadyUnsubscribed: subscriber.status === 'UNSUBSCRIBED' }
}

/** Sets UNSUBSCRIBED and writes a ConsentEvent with source UNSUBSCRIBE_LINK. Idempotent — confirming an already-unsubscribed token succeeds without writing a duplicate event. */
export async function confirmUnsubscribeByToken(token: string): Promise<boolean> {
  const subscriber = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } })
  if (!subscriber) return false
  if (subscriber.status === 'UNSUBSCRIBED') return true

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.subscriber.update({ where: { id: subscriber.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: now } })
    await tx.consentEvent.create({
      data: { subscriberId: subscriber.id, eventType: 'UNSUBSCRIBED', source: 'UNSUBSCRIBE_LINK', occurredAt: now },
    })
  })
  return true
}

/** The confirmation page's "in case of a mistaken click" escape hatch. Writes a RESUBSCRIBED ConsentEvent, still attributed to the unsubscribe link/page. */
export async function resubscribeByToken(token: string): Promise<boolean> {
  const subscriber = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } })
  if (!subscriber) return false
  if (subscriber.status === 'SUBSCRIBED') return true

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.subscriber.update({
      where: { id: subscriber.id },
      data: { status: 'SUBSCRIBED', subscribedAt: now, unsubscribedAt: null },
    })
    await tx.consentEvent.create({
      data: { subscriberId: subscriber.id, eventType: 'RESUBSCRIBED', source: 'UNSUBSCRIBE_LINK', occurredAt: now },
    })
  })
  return true
}

/** Builds the public unsubscribe URL for a token — the one place this happens, so every caller (email footer, tests) agrees on the shape. */
export function buildUnsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`
}
