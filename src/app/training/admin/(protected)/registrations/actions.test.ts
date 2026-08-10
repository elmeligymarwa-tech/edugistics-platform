import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/training/email/send-registration-email', () => ({
  sendConfirmedEmail: vi.fn().mockResolvedValue('email-id'),
  sendWaitlistedEmail: vi.fn().mockResolvedValue('email-id'),
  sendPromotedEmail: vi.fn().mockResolvedValue('email-id'),
}))

const { updateRegistrationAction } = await import('./actions')
const { registerForCourse } = await import('@/lib/training/register-for-course')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts.
const MARKER = 'registrations-actions-test'
const courseIds: string[] = []
const teacherEmails: string[] = []

const courseDefaults = {
  shortDescription: 'x',
  fullDescription: 'x',
  category: 'LEADERSHIP' as const,
  startTime: new Date('1970-01-01T09:00:00.000Z'),
  endTime: new Date('1970-01-01T10:00:00.000Z'),
  durationMinutes: 60,
  deliveryMethod: 'ONLINE' as const,
  courseDate: new Date('2026-06-01T00:00:00.000Z'),
  isActive: true,
}

let counter = 0
async function makeRegistration(marketingConsent: boolean) {
  counter += 1
  const slug = `${MARKER}-${Date.now()}-${counter}`
  const course = await prisma.course.create({ data: { ...courseDefaults, name: slug, slug, maxCapacity: null } })
  courseIds.push(course.id)

  const email = `${MARKER}-${Date.now()}-${counter}@test.local`
  teacherEmails.push(email)
  const outcome = await registerForCourse({
    courseId: course.id,
    fullName: 'Test Teacher',
    email,
    phone: '+201000000000',
    schoolName: `${MARKER} School`,
    subject: 'Mathematics',
    grade: 'Grade 3',
    address: null,
    marketingConsent,
    promoCode: null,
    ip: '127.0.0.1',
  })
  const registration = await prisma.registration.findUniqueOrThrow({ where: { reference: outcome.reference } })
  return { registration, email }
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { emailNormalised: { in: teacherEmails } } } })
  await prisma.subscriber.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.registration.deleteMany({ where: { courseId: { in: courseIds } } })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.school.deleteMany({ where: { canonicalName: { startsWith: MARKER } } })
  await prisma.auditLog.deleteMany({ where: { entityType: 'Registration', entityId: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('updateRegistrationAction — consent checkbox removed', () => {
  it('accepts an edit payload with no marketingConsent field', async () => {
    const { registration } = await makeRegistration(false)

    const result = await updateRegistrationAction(registration.id, {
      fullName: 'Updated Name',
      email: `updated-${registration.id}@test.local`,
      phone: '+201000000001',
      schoolName: `${MARKER} School`,
      subject: 'Physics',
      grade: 'Grade 4',
      address: 'New address',
    })
    teacherEmails.push(`updated-${registration.id}@test.local`)

    expect(result.success).toBe(true)
  })

  it('never writes Teacher.marketingConsent, even if a legacy client still sends the field', async () => {
    const { registration, email } = await makeRegistration(false)

    // A hostile or stale client payload still carrying the removed field —
    // the schema must strip it, and the write must never touch the column.
    const result = await updateRegistrationAction(registration.id, {
      fullName: 'Updated Name',
      email,
      phone: '+201000000002',
      schoolName: `${MARKER} School`,
      subject: 'Physics',
      grade: 'Grade 4',
      address: 'New address',
      marketingConsent: true,
    })

    expect(result.success).toBe(true)
    const teacher = await prisma.teacher.findUnique({ where: { emailNormalised: email.toLowerCase() } })
    expect(teacher?.marketingConsent).toBe(false)
    expect(teacher?.marketingConsentAt).toBeNull()
  })

  it('leaves a previously-true marketingConsent value untouched by an edit', async () => {
    const { registration, email } = await makeRegistration(true)

    const result = await updateRegistrationAction(registration.id, {
      fullName: 'Updated Name',
      email,
      phone: '+201000000003',
      schoolName: `${MARKER} School`,
      subject: 'Physics',
      grade: 'Grade 4',
      address: 'New address',
    })

    expect(result.success).toBe(true)
    const teacher = await prisma.teacher.findUnique({ where: { emailNormalised: email.toLowerCase() } })
    expect(teacher?.marketingConsent).toBe(true)
  })
})
