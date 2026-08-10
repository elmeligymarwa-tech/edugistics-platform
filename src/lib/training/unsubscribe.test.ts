import { afterAll, describe, expect, it } from 'vitest'

const { resolveUnsubscribeToken, confirmUnsubscribeByToken, resubscribeByToken, maskEmail, buildUnsubscribeUrl } = await import('./unsubscribe')
const { generateUnsubscribeToken } = await import('./unsubscribe-token')
const { prisma } = await import('./prisma')

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts.
const MARKER = 'unsubscribe-test'
const teacherEmails: string[] = []

let counter = 0
async function makeSubscriber(status: 'SUBSCRIBED' | 'UNSUBSCRIBED' = 'SUBSCRIBED') {
  counter += 1
  const email = `${MARKER}-${Date.now()}-${counter}@test.local`
  teacherEmails.push(email)
  const now = new Date()
  const subscriber = await prisma.subscriber.create({
    data: {
      teacherId: null,
      emailNormalised: email,
      fullName: 'Test Person',
      emailOriginal: email,
      status,
      subscribedAt: now,
      unsubscribedAt: status === 'UNSUBSCRIBED' ? now : null,
      consentSource: 'LANDING_PAGE',
      consentWordingVersion: 'v2',
      unsubscribeToken: generateUnsubscribeToken(),
    },
  })
  await prisma.consentEvent.create({
    data: { subscriberId: subscriber.id, eventType: 'SUBSCRIBED', source: 'LANDING_PAGE', occurredAt: now },
  })
  return subscriber
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { emailNormalised: { in: teacherEmails } } } })
  await prisma.subscriber.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.$disconnect()
})

describe('maskEmail', () => {
  it('shows only the first couple of characters of the local part', () => {
    expect(maskEmail('jonathan@example.com')).toBe('jo******@example.com')
    expect(maskEmail('ab@example.com')).toMatch(/^ab\*+@example\.com$/)
  })
})

describe('resolveUnsubscribeToken — read-only', () => {
  it('never mutates the subscriber it looks up', async () => {
    const subscriber = await makeSubscriber('SUBSCRIBED')

    const info = await resolveUnsubscribeToken(subscriber.unsubscribeToken)
    expect(info).not.toBeNull()
    expect(info!.alreadyUnsubscribed).toBe(false)

    const unchanged = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(unchanged.status).toBe('SUBSCRIBED')
    expect(unchanged.unsubscribedAt).toBeNull()

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id } })
    expect(events).toHaveLength(1)
  })

  it('returns null for an unknown token, revealing nothing else', async () => {
    const info = await resolveUnsubscribeToken('this-token-does-not-exist-in-the-database')
    expect(info).toBeNull()
  })
})

describe('confirmUnsubscribeByToken', () => {
  it('sets UNSUBSCRIBED and writes a ConsentEvent with source UNSUBSCRIBE_LINK', async () => {
    const subscriber = await makeSubscriber('SUBSCRIBED')

    const ok = await confirmUnsubscribeByToken(subscriber.unsubscribeToken)
    expect(ok).toBe(true)

    const updated = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(updated.status).toBe('UNSUBSCRIBED')
    expect(updated.unsubscribedAt).not.toBeNull()

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id }, orderBy: { occurredAt: 'asc' } })
    expect(events).toHaveLength(2)
    expect(events[1]!.eventType).toBe('UNSUBSCRIBED')
    expect(events[1]!.source).toBe('UNSUBSCRIBE_LINK')
  })

  it('is idempotent — confirming an already-unsubscribed token succeeds without a duplicate event', async () => {
    const subscriber = await makeSubscriber('UNSUBSCRIBED')

    const ok = await confirmUnsubscribeByToken(subscriber.unsubscribeToken)
    expect(ok).toBe(true)

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id } })
    expect(events).toHaveLength(1)
  })

  it('returns false for an unknown token and writes nothing', async () => {
    const ok = await confirmUnsubscribeByToken('another-token-that-does-not-exist')
    expect(ok).toBe(false)
  })
})

describe('resubscribeByToken', () => {
  it('resubscribes from the confirmation page, writing a RESUBSCRIBED event attributed to the unsubscribe link', async () => {
    const subscriber = await makeSubscriber('UNSUBSCRIBED')

    const ok = await resubscribeByToken(subscriber.unsubscribeToken)
    expect(ok).toBe(true)

    const updated = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(updated.status).toBe('SUBSCRIBED')
    expect(updated.unsubscribedAt).toBeNull()

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id }, orderBy: { occurredAt: 'asc' } })
    expect(events[1]!.eventType).toBe('RESUBSCRIBED')
    expect(events[1]!.source).toBe('UNSUBSCRIBE_LINK')
  })
})

describe('buildUnsubscribeUrl', () => {
  it('carries the token as a query parameter', () => {
    const url = buildUnsubscribeUrl('https://edugistics.online', 'abc123')
    expect(url).toBe('https://edugistics.online/unsubscribe?token=abc123')
  })
})
