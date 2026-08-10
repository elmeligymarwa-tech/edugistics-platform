import { afterAll, describe, expect, it } from 'vitest'

const { subscribeFromLandingPage } = await import('./landing-subscribe')
const { prisma } = await import('./prisma')

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts.
const MARKER = 'landing-subscribe-test'
const teacherEmails: string[] = []

let counter = 0
function makeEmail(): string {
  counter += 1
  const email = `${MARKER}-${Date.now()}-${counter}@test.local`
  teacherEmails.push(email)
  return email
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { emailNormalised: { in: teacherEmails } } } })
  await prisma.subscriber.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.$disconnect()
})

describe('subscribeFromLandingPage', () => {
  it('creates a subscriber with source LANDING_PAGE, wording v2, no teacher, and a SUBSCRIBED event', async () => {
    const email = makeEmail()
    await subscribeFromLandingPage({ fullName: 'Jane Doe', email, now: new Date() })

    const subscriber = await prisma.subscriber.findUniqueOrThrow({ where: { emailNormalised: email.toLowerCase() } })
    expect(subscriber.teacherId).toBeNull()
    expect(subscriber.status).toBe('SUBSCRIBED')
    expect(subscriber.consentSource).toBe('LANDING_PAGE')
    expect(subscriber.consentWordingVersion).toBe('v2')
    expect(subscriber.fullName).toBe('Jane Doe')
    expect(subscriber.emailOriginal).toBe(email)
    expect(subscriber.unsubscribeToken).toBeTruthy()

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id } })
    expect(events).toHaveLength(1)
    expect(events[0]!.eventType).toBe('SUBSCRIBED')
    expect(events[0]!.source).toBe('LANDING_PAGE')
    expect(events[0]!.wordingVersion).toBe('v2')
  })

  it('a repeat submission from an already-subscribed address changes nothing but logs a SUBSCRIBED event', async () => {
    const email = makeEmail()
    const first = new Date('2026-01-01T00:00:00.000Z')
    await subscribeFromLandingPage({ fullName: 'Jane Doe', email, now: first })

    const second = new Date('2026-01-02T00:00:00.000Z')
    await subscribeFromLandingPage({ fullName: 'Jane Doe', email, now: second })

    const subscriber = await prisma.subscriber.findUniqueOrThrow({ where: { emailNormalised: email.toLowerCase() } })
    expect(subscriber.status).toBe('SUBSCRIBED')
    // subscribedAt is untouched by the repeat submission — still the original date.
    expect(subscriber.subscribedAt.toISOString()).toBe(first.toISOString())

    const subscribers = await prisma.subscriber.findMany({ where: { emailNormalised: email.toLowerCase() } })
    expect(subscribers).toHaveLength(1)

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id }, orderBy: { occurredAt: 'asc' } })
    expect(events).toHaveLength(2)
    expect(events.map((e) => e.eventType)).toEqual(['SUBSCRIBED', 'SUBSCRIBED'])
  })

  it('an unsubscribed address resubscribing writes a RESUBSCRIBED event and clears unsubscribedAt', async () => {
    const email = makeEmail()
    await subscribeFromLandingPage({ fullName: 'Jane Doe', email, now: new Date('2026-01-01T00:00:00.000Z') })

    const subscriber = await prisma.subscriber.findUniqueOrThrow({ where: { emailNormalised: email.toLowerCase() } })
    await prisma.subscriber.update({ where: { id: subscriber.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } })

    const resubscribeAt = new Date('2026-02-01T00:00:00.000Z')
    await subscribeFromLandingPage({ fullName: 'Jane Doe', email, now: resubscribeAt })

    const updated = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(updated.status).toBe('SUBSCRIBED')
    expect(updated.unsubscribedAt).toBeNull()
    expect(updated.subscribedAt.toISOString()).toBe(resubscribeAt.toISOString())

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id }, orderBy: { occurredAt: 'asc' } })
    expect(events.map((e) => e.eventType)).toEqual(['SUBSCRIBED', 'RESUBSCRIBED'])
  })
})
