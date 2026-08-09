import { afterAll, describe, expect, it } from 'vitest'

const { validatePromoCodeForCourse } = await import('./promo-code-validation')
const { prisma } = await import('./prisma')

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts —
// hits the real database. Apply-time validation only (lockRow: false); submission-time
// re-validation under lock is covered in register-for-course.test.ts, where a transaction
// is actually available to lock within.
const MARKER = 'promo-code-validation-test'
const courseIds: string[] = []
const promoCodeIds: string[] = []

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
  feeAmount: 1000,
  currency: 'EGP',
}

let slugCounter = 0
async function makeCourse(overrides: Partial<Parameters<typeof prisma.course.create>[0]['data']> = {}) {
  slugCounter += 1
  const slug = `${MARKER}-${Date.now()}-${slugCounter}`
  const course = await prisma.course.create({ data: { ...courseDefaults, name: slug, slug, ...overrides } })
  courseIds.push(course.id)
  return course
}

let codeCounter = 0
function randomCode(): string {
  codeCounter += 1
  return `PCVTEST${Date.now().toString(36)}${codeCounter}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function makePromoCode(overrides: Partial<Parameters<typeof prisma.promoCode.create>[0]['data']> = {}) {
  const promoCode = await prisma.promoCode.create({
    data: {
      code: randomCode(),
      description: MARKER,
      discountType: 'PERCENTAGE',
      discountValue: 20,
      appliesToAllCourses: true,
      ...overrides,
    },
  })
  promoCodeIds.push(promoCode.id)
  return promoCode
}

afterAll(async () => {
  await prisma.promoCodeCourse.deleteMany({ where: { promoCodeId: { in: promoCodeIds } } })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('validatePromoCodeForCourse', () => {
  it('a valid percentage discount produces the correct final fee', async () => {
    const course = await makeCourse({ feeAmount: 2000 })
    const promo = await makePromoCode({ discountType: 'PERCENTAGE', discountValue: 20 })

    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.originalFee).toBe(2000)
    expect(result.discountAmount).toBe(400)
    expect(result.finalFee).toBe(1600)
  })

  it('a valid fixed amount discount produces the correct final fee', async () => {
    const course = await makeCourse({ feeAmount: 1000, currency: 'EGP' })
    const promo = await makePromoCode({ discountType: 'FIXED_AMOUNT', discountValue: 50, currency: 'EGP' })

    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.discountAmount).toBe(50)
    expect(result.finalFee).toBe(950)
  })

  it('a fixed discount larger than the course fee clamps the final fee to zero, never negative', async () => {
    const course = await makeCourse({ feeAmount: 100, currency: 'EGP' })
    const promo = await makePromoCode({ discountType: 'FIXED_AMOUNT', discountValue: 500, currency: 'EGP' })

    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.discountAmount).toBe(100)
    expect(result.finalFee).toBe(0)
  })

  it('a currency mismatch on a fixed discount is rejected with the generic invalid message', async () => {
    const course = await makeCourse({ feeAmount: 1000, currency: 'USD' })
    const promo = await makePromoCode({ discountType: 'FIXED_AMOUNT', discountValue: 50, currency: 'EGP' })

    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('Invalid promo code.')
  })

  it('an invalid (non-existent) code returns the generic invalid message', async () => {
    const course = await makeCourse()
    const result = await validatePromoCodeForCourse({ db: prisma, code: 'DOESNOTEXIST12345', course })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('Invalid promo code.')
  })

  it('an expired code is rejected', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode({ expiresAt: new Date('2020-01-01T00:00:00.000Z') })
    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('This promo code has expired.')
  })

  it('a scheduled code with a future start date is rejected', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode({ startsAt: new Date('2099-01-01T00:00:00.000Z') })
    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('This promo code is not yet available.')
  })

  it('a paused code is rejected', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode({ isPaused: true })
    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('This promo code is no longer available.')
  })

  it('an archived code is rejected with the generic invalid message', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode({ archivedAt: new Date() })
    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('Invalid promo code.')
  })

  it('a course-restricted code is rejected on a different course', async () => {
    const eligibleCourse = await makeCourse()
    const otherCourse = await makeCourse()
    const promo = await prisma.promoCode.create({
      data: {
        code: randomCode(),
        description: MARKER,
        discountType: 'PERCENTAGE',
        discountValue: 10,
        appliesToAllCourses: false,
        courses: { create: [{ courseId: eligibleCourse.id }] },
      },
    })
    promoCodeIds.push(promo.id)

    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course: otherCourse })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('This promo code is not available for this course.')

    const eligibleResult = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course: eligibleCourse })
    expect(eligibleResult.ok).toBe(true)
  })

  it('an all-courses code is accepted on any course', async () => {
    const promo = await makePromoCode({ appliesToAllCourses: true })
    const courseA = await makeCourse()
    const courseB = await makeCourse()

    expect((await validatePromoCodeForCourse({ db: prisma, code: promo.code, course: courseA })).ok).toBe(true)
    expect((await validatePromoCodeForCourse({ db: prisma, code: promo.code, course: courseB })).ok).toBe(true)
  })

  it('lowercase and mixed case entry resolve to the same code', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode()

    const lower = await validatePromoCodeForCourse({ db: prisma, code: promo.code.toLowerCase(), course })
    const mixed = await validatePromoCodeForCourse({
      db: prisma,
      code: promo.code[0]!.toLowerCase() + promo.code.slice(1),
      course,
    })
    expect(lower.ok).toBe(true)
    expect(mixed.ok).toBe(true)
  })

  it('never discloses the discount value or eligibility reason for a code the caller is not eligible for', async () => {
    const eligibleCourse = await makeCourse()
    const otherCourse = await makeCourse()
    const promo = await prisma.promoCode.create({
      data: {
        code: randomCode(),
        description: MARKER,
        discountType: 'PERCENTAGE',
        discountValue: 90,
        appliesToAllCourses: false,
        courses: { create: [{ courseId: eligibleCourse.id }] },
      },
    })
    promoCodeIds.push(promo.id)

    const result = await validatePromoCodeForCourse({ db: prisma, code: promo.code, course: otherCourse })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).not.toMatch(/90|percent|%/i)
  })
})
