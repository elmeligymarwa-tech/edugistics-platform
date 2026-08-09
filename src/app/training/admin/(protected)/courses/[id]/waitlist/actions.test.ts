import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))

const sendPromotedEmail = vi.fn().mockResolvedValue('email-id')
vi.mock('@/lib/training/email/send-registration-email', () => ({
  sendPromotedEmail: (...args: unknown[]) => sendPromotedEmail(...args),
}))

const { promoteRegistrationAction } = await import('./actions')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning; hits the real database, since the
// promotion logic's row-locked capacity check and position resequencing
// have no mockable boundary from Postgres.
const MARKER = 'promote-action-test'
let courseId: string
const teacherIds: string[] = []
const registrationIds: string[] = []
const promoCodeIds: string[] = []

let codeCounter = 0
function randomCode(): string {
  codeCounter += 1
  return `PROMOTETEST${Date.now().toString(36)}${codeCounter}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function makePromoCode(overrides: Partial<Parameters<typeof prisma.promoCode.create>[0]['data']> = {}) {
  const promoCode = await prisma.promoCode.create({
    data: {
      code: randomCode(),
      description: MARKER,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      appliesToAllCourses: true,
      ...overrides,
    },
  })
  promoCodeIds.push(promoCode.id)
  return promoCode
}

async function makeTeacher(index: number) {
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: `${MARKER}-${index}@test.local`,
      emailOriginal: `${MARKER}-${index}@test.local`,
      fullName: `${MARKER} Teacher ${index}`,
      phone: `+20100000${index}`,
      phoneNormalised: `+20100000${index}`,
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
  teacherIds.push(teacher.id)
  return teacher
}

async function makeRegistration(
  teacherId: string,
  status: 'CONFIRMED' | 'WAITLISTED',
  waitlistPosition: number | null,
  overrides: Partial<Prisma.RegistrationUncheckedCreateInput> = {},
) {
  const registration = await prisma.registration.create({
    data: {
      reference: `${MARKER}-${teacherId}`,
      teacherId,
      courseId,
      courseNameSnapshot: 'x',
      courseDateSnapshot: new Date('2026-08-01T00:00:00.000Z'),
      courseFeeSnapshot: 0,
      courseCurrencySnapshot: 'EGP',
      status,
      waitlistPosition,
      emailType: status,
      ...overrides,
    },
  })
  registrationIds.push(registration.id)
  return registration
}

beforeEach(async () => {
  const course = await prisma.course.create({
    data: {
      name: `${MARKER} ${Date.now()}`,
      slug: `${MARKER}-${Date.now()}`,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-08-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      maxCapacity: 1,
      waitlistEnabled: true,
      waitlistCapacity: 5,
    },
  })
  courseId = course.id
}, 10_000)

afterEach(() => {
  sendPromotedEmail.mockClear()
  sendPromotedEmail.mockResolvedValue('email-id')
})

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.course.deleteMany({ where: { slug: { startsWith: MARKER } } })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.$disconnect()
})

describe('promoteRegistrationAction', () => {
  it('promotes a waitlisted registration to CONFIRMED, sends the promoted email, and resequences the remaining waitlist with no gaps', async () => {
    const teacherA = await makeTeacher(1)
    const teacherB = await makeTeacher(2)
    const teacherC = await makeTeacher(3)

    // Course confirmed at capacity already via a cancelled slot freed up —
    // set maxCapacity higher for this scenario so the promotion is unblocked.
    await prisma.course.update({ where: { id: courseId }, data: { maxCapacity: 2 } })
    await makeRegistration(teacherA.id, 'CONFIRMED', null)
    const regB = await makeRegistration(teacherB.id, 'WAITLISTED', 1)
    const regC = await makeRegistration(teacherC.id, 'WAITLISTED', 2)

    const result = await promoteRegistrationAction(regB.id)
    expect(result.success).toBe(true)
    expect(sendPromotedEmail).toHaveBeenCalledOnce()

    const promoted = await prisma.registration.findUniqueOrThrow({ where: { id: regB.id } })
    expect(promoted.status).toBe('CONFIRMED')
    expect(promoted.waitlistPosition).toBeNull()
    expect(promoted.promotedAt).not.toBeNull()

    const resequenced = await prisma.registration.findUniqueOrThrow({ where: { id: regC.id } })
    expect(resequenced.status).toBe('WAITLISTED')
    expect(resequenced.waitlistPosition).toBe(1) // moved up from 2 — no gap left behind
  }, 20_000)

  it('blocks promotion at capacity unless explicitly overridden, and logs the override', async () => {
    const teacherA = await makeTeacher(4)
    const teacherB = await makeTeacher(5)
    await makeRegistration(teacherA.id, 'CONFIRMED', null) // fills maxCapacity: 1
    const regB = await makeRegistration(teacherB.id, 'WAITLISTED', 1)

    const blocked = await promoteRegistrationAction(regB.id)
    expect(blocked.success).toBe(false)
    if (!blocked.success) expect(blocked.blockedAtCapacity).toBe(true)

    const stillWaitlisted = await prisma.registration.findUniqueOrThrow({ where: { id: regB.id } })
    expect(stillWaitlisted.status).toBe('WAITLISTED')

    const overridden = await promoteRegistrationAction(regB.id, true)
    expect(overridden.success).toBe(true)

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityId: regB.id, action: 'REGISTRATION_PROMOTED_OVERRIDE' },
    })
    expect(auditEntry).not.toBeNull()
  }, 20_000)

  it('promoting a waitlisted registration consumes the use when the code is still valid', async () => {
    await prisma.course.update({ where: { id: courseId }, data: { maxCapacity: 5, feeAmount: 1000 } })
    const promo = await makePromoCode({ discountType: 'PERCENTAGE', discountValue: 10 })
    const teacher = await makeTeacher(6)
    const reg = await makeRegistration(teacher.id, 'WAITLISTED', 1, {
      promoCodeId: promo.id,
      promoCodeSnapshot: promo.code,
      discountTypeSnapshot: 'PERCENTAGE',
      discountValueSnapshot: 10,
      discountAmount: 100,
      originalFee: 1000,
      finalFee: 900,
      promoAppliedAt: new Date(),
    })

    const result = await promoteRegistrationAction(reg.id)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.discountLost).toBe(false)

    const promoted = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })
    expect(promoted.status).toBe('CONFIRMED')
    // The snapshot stands — untouched by promotion.
    expect(promoted.promoCodeSnapshot).toBe(promo.code)
    expect(Number(promoted.finalFee)).toBe(900)

    // The use is now consumed — usage counting only ever counts CONFIRMED rows.
    const confirmedUses = await prisma.registration.count({ where: { promoCodeId: promo.id, status: 'CONFIRMED' } })
    expect(confirmedUses).toBe(1)

    expect(sendPromotedEmail).toHaveBeenCalledWith(
      teacher.emailOriginal,
      expect.objectContaining({ feeAmount: 900, promo: expect.objectContaining({ code: promo.code }) }),
    )
  }, 20_000)

  it('promoting when the code is no longer valid proceeds at full price and clears the snapshot', async () => {
    await prisma.course.update({ where: { id: courseId }, data: { maxCapacity: 5, feeAmount: 1000 } })
    const promo = await makePromoCode({ discountType: 'PERCENTAGE', discountValue: 10 })
    // Invalidate the code before promotion — archived, so re-validation fails.
    await prisma.promoCode.update({ where: { id: promo.id }, data: { archivedAt: new Date() } })

    const teacher = await makeTeacher(7)
    const reg = await makeRegistration(teacher.id, 'WAITLISTED', 1, {
      promoCodeId: promo.id,
      promoCodeSnapshot: promo.code,
      discountTypeSnapshot: 'PERCENTAGE',
      discountValueSnapshot: 10,
      discountAmount: 100,
      originalFee: 1000,
      finalFee: 900,
      promoAppliedAt: new Date(),
    })

    const result = await promoteRegistrationAction(reg.id)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.discountLost).toBe(true)

    const promoted = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })
    expect(promoted.status).toBe('CONFIRMED')
    expect(promoted.promoCodeId).toBeNull()
    expect(promoted.promoCodeSnapshot).toBeNull()
    expect(promoted.discountTypeSnapshot).toBeNull()
    expect(promoted.discountValueSnapshot).toBeNull()
    expect(promoted.discountAmount).toBeNull()
    expect(promoted.originalFee).toBeNull()
    expect(promoted.finalFee).toBeNull()
    expect(promoted.promoAppliedAt).toBeNull()

    expect(sendPromotedEmail).toHaveBeenCalledWith(
      teacher.emailOriginal,
      expect.objectContaining({ feeAmount: 1000, promo: null }),
    )
  }, 20_000)
})
