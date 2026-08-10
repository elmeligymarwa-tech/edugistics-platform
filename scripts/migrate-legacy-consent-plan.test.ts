import { afterAll, describe, expect, it } from 'vitest'

import { prisma } from '../src/lib/training/prisma'
import { FIXTURE_TEACHER_EMAIL_DOMAIN } from './training-analytics-fixture-plan.ts'
import { previewLegacyConsentMigration, runLegacyConsentMigration } from './migrate-legacy-consent-plan.ts'

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts.
const MARKER = 'migrate-legacy-consent-test'
const teacherIds: string[] = []
const teacherEmails: string[] = []

let counter = 0
async function makeTeacher(overrides: Partial<Parameters<typeof prisma.teacher.create>[0]['data']> = {}) {
  counter += 1
  const email = `${MARKER}-${Date.now()}-${counter}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: 'Test Teacher',
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
      ...overrides,
    },
  })
  teacherIds.push(teacher.id)
  teacherEmails.push(teacher.emailNormalised)
  return teacher
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { teacherId: { in: teacherIds } } } })
  await prisma.subscriber.deleteMany({ where: { teacherId: { in: teacherIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.$disconnect()
})

describe('migrate-legacy-consent-plan', () => {
  it('previews one subscriber per consenting teacher and none for the rest, excluding fixture data', async () => {
    const consenting = await makeTeacher({ marketingConsent: true, marketingConsentAt: new Date('2026-01-01T00:00:00.000Z') })
    await makeTeacher({ marketingConsent: false })
    const fixtureLike = await makeTeacher({
      marketingConsent: true,
      emailNormalised: `${MARKER}-fixture@${FIXTURE_TEACHER_EMAIL_DOMAIN}`,
      emailOriginal: `${MARKER}-fixture@${FIXTURE_TEACHER_EMAIL_DOMAIN}`,
    })

    const preview = await previewLegacyConsentMigration(prisma, { scopeToTeacherIds: teacherIds })
    expect(preview.eligibleTeacherIds).toContain(consenting.id)
    expect(preview.eligibleTeacherIds).not.toContain(fixtureLike.id)
  })

  it('does nothing without --confirm — preview never writes', async () => {
    const consenting = await makeTeacher({ marketingConsent: true })
    await previewLegacyConsentMigration(prisma, { scopeToTeacherIds: teacherIds })

    const subscriber = await prisma.subscriber.findUnique({ where: { teacherId: consenting.id } })
    expect(subscriber).toBeNull()
  })

  it('creates a subscriber and a MIGRATED consent event for each consenting teacher, using marketingConsentAt as subscribedAt', async () => {
    const consentedAt = new Date('2025-06-15T10:00:00.000Z')
    const consenting = await makeTeacher({ marketingConsent: true, marketingConsentAt: consentedAt })
    const nonConsenting = await makeTeacher({ marketingConsent: false })

    const { created } = await runLegacyConsentMigration(prisma, { scopeToTeacherIds: teacherIds })
    expect(created).toBeGreaterThanOrEqual(1)

    const subscriber = await prisma.subscriber.findUnique({ where: { teacherId: consenting.id } })
    expect(subscriber?.status).toBe('SUBSCRIBED')
    expect(subscriber?.consentSource).toBe('MIGRATED')
    expect(subscriber?.consentWordingVersion).toBe('v0-migrated')
    expect(subscriber?.subscribedAt.toISOString()).toBe(consentedAt.toISOString())
    expect(subscriber?.unsubscribeToken).toBeTruthy()

    const event = await prisma.consentEvent.findFirst({ where: { subscriberId: subscriber!.id } })
    expect(event?.eventType).toBe('SUBSCRIBED')
    expect(event?.source).toBe('MIGRATED')

    const noSubscriber = await prisma.subscriber.findUnique({ where: { teacherId: nonConsenting.id } })
    expect(noSubscriber).toBeNull()
  })

  it('is idempotent — running twice creates no duplicate subscriber', async () => {
    const consenting = await makeTeacher({ marketingConsent: true })

    await runLegacyConsentMigration(prisma, { scopeToTeacherIds: teacherIds })
    await runLegacyConsentMigration(prisma, { scopeToTeacherIds: teacherIds })

    const subscribers = await prisma.subscriber.findMany({ where: { teacherId: consenting.id } })
    expect(subscribers).toHaveLength(1)
  })

  it('excludes fixture-domain teachers from an actual run', async () => {
    const fixtureLike = await makeTeacher({
      marketingConsent: true,
      emailNormalised: `${MARKER}-fixture2@${FIXTURE_TEACHER_EMAIL_DOMAIN}`,
      emailOriginal: `${MARKER}-fixture2@${FIXTURE_TEACHER_EMAIL_DOMAIN}`,
    })

    await runLegacyConsentMigration(prisma, { scopeToTeacherIds: teacherIds })

    const subscriber = await prisma.subscriber.findUnique({ where: { teacherId: fixtureLike.id } })
    expect(subscriber).toBeNull()
  })
})
