import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { manualUnsubscribeAction, manualResubscribeAction, getSubscriberSelectionSummaryAction } = await import('./actions')
const { generateUnsubscribeToken } = await import('@/lib/training/unsubscribe-token')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts.
const MARKER = 'subscribers-actions-test'
const teacherIds: string[] = []
const subscriberIds: string[] = []

let counter = 0
async function makeSubscriber(status: 'SUBSCRIBED' | 'UNSUBSCRIBED') {
  counter += 1
  const email = `${MARKER}-${Date.now()}-${counter}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${counter}`,
      phone: '+201000000000',
      phoneNormalised: '+201000000000',
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      marketingConsent: false,
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
  teacherIds.push(teacher.id)

  const now = new Date()
  const subscriber = await prisma.subscriber.create({
    data: {
      teacherId: teacher.id,
      emailNormalised: email,
      status,
      subscribedAt: now,
      unsubscribedAt: status === 'UNSUBSCRIBED' ? now : null,
      consentSource: 'TRAINING_REGISTRATION',
      consentWordingVersion: 'v1',
      unsubscribeToken: generateUnsubscribeToken(),
    },
  })
  await prisma.consentEvent.create({
    data: { subscriberId: subscriber.id, eventType: 'SUBSCRIBED', source: 'TRAINING_REGISTRATION', occurredAt: now },
  })
  subscriberIds.push(subscriber.id)

  return { teacher, subscriber }
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { teacherId: { in: teacherIds } } } })
  await prisma.subscriber.deleteMany({ where: { teacherId: { in: teacherIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.auditLog.deleteMany({ where: { entityType: 'Subscriber', entityId: { in: subscriberIds } } })
  await prisma.$disconnect()
})

describe('manualUnsubscribeAction', () => {
  it('writes a ConsentEvent with source ADMIN_MANUAL and sets statusChangedBy to ADMIN', async () => {
    const { subscriber } = await makeSubscriber('SUBSCRIBED')

    const result = await manualUnsubscribeAction(subscriber.id)
    expect(result.success).toBe(true)

    const updated = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(updated.status).toBe('UNSUBSCRIBED')
    expect(updated.statusChangedBy).toBe('ADMIN')
    expect(updated.unsubscribedAt).not.toBeNull()

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id }, orderBy: { occurredAt: 'asc' } })
    expect(events).toHaveLength(2)
    expect(events[1]!.eventType).toBe('UNSUBSCRIBED')
    expect(events[1]!.source).toBe('ADMIN_MANUAL')
  })

  it('writes an audit log entry', async () => {
    const { subscriber } = await makeSubscriber('SUBSCRIBED')
    await manualUnsubscribeAction(subscriber.id)

    const entry = await prisma.auditLog.findFirst({ where: { entityType: 'Subscriber', entityId: subscriber.id, action: 'SUBSCRIBER_UNSUBSCRIBED_MANUALLY' } })
    expect(entry).not.toBeNull()
  })

  it('rejects unsubscribing an already-unsubscribed contact rather than writing a duplicate event', async () => {
    const { subscriber } = await makeSubscriber('UNSUBSCRIBED')
    const result = await manualUnsubscribeAction(subscriber.id)
    expect(result.success).toBe(false)

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id } })
    expect(events).toHaveLength(1)
  })
})

describe('manualResubscribeAction', () => {
  it('rejects a missing or incorrect typed confirmation, and writes no ConsentEvent', async () => {
    const { subscriber } = await makeSubscriber('UNSUBSCRIBED')

    const wrong = await manualResubscribeAction(subscriber.id, 'resubscribe')
    expect(wrong.success).toBe(false)

    const blank = await manualResubscribeAction(subscriber.id, '')
    expect(blank.success).toBe(false)

    const unchanged = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(unchanged.status).toBe('UNSUBSCRIBED')
    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id } })
    expect(events).toHaveLength(1)
  })

  it('resubscribes when the exact confirmation word is typed, writing a RESUBSCRIBED ConsentEvent with source ADMIN_MANUAL', async () => {
    const { subscriber } = await makeSubscriber('UNSUBSCRIBED')

    const result = await manualResubscribeAction(subscriber.id, 'RESUBSCRIBE')
    expect(result.success).toBe(true)

    const updated = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(updated.status).toBe('SUBSCRIBED')
    expect(updated.unsubscribedAt).toBeNull()
    expect(updated.statusChangedBy).toBe('ADMIN')

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id }, orderBy: { occurredAt: 'asc' } })
    expect(events).toHaveLength(2)
    expect(events[1]!.eventType).toBe('RESUBSCRIBED')
    expect(events[1]!.source).toBe('ADMIN_MANUAL')
  })

  it('writes an audit log entry', async () => {
    const { subscriber } = await makeSubscriber('UNSUBSCRIBED')
    await manualResubscribeAction(subscriber.id, 'RESUBSCRIBE')

    const entry = await prisma.auditLog.findFirst({ where: { entityType: 'Subscriber', entityId: subscriber.id, action: 'SUBSCRIBER_RESUBSCRIBED_MANUALLY' } })
    expect(entry).not.toBeNull()
  })
})

describe('every status change writes a ConsentEvent', () => {
  it('the ConsentEvent count always matches the number of status-changing actions taken', async () => {
    const { subscriber } = await makeSubscriber('SUBSCRIBED')
    // Starts with 1 (the initial SUBSCRIBED event from makeSubscriber).
    await manualUnsubscribeAction(subscriber.id)
    await manualResubscribeAction(subscriber.id, 'RESUBSCRIBE')

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id } })
    expect(events).toHaveLength(3)
  })
})

describe('getSubscriberSelectionSummaryAction', () => {
  it('never counts an unsubscribed contact', async () => {
    const { subscriber: subscribed } = await makeSubscriber('SUBSCRIBED')
    const { subscriber: unsubscribed } = await makeSubscriber('UNSUBSCRIBED')

    const result = await getSubscriberSelectionSummaryAction({ mode: 'ids', subscriberIds: [subscribed.id, unsubscribed.id] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.count).toBe(1)
  })
})
