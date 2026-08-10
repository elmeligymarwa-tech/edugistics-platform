import { afterAll, describe, expect, it } from 'vitest'

const { getPromoCodeDashboardSummary, getPromoCodeDetail, getPromoCodeUsageAggregates, listAllPromoCodesForExport } = await import(
  './promo-codes'
)
const { prisma } = await import('./prisma')

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts —
// hits the real database.
const MARKER = 'promo-codes-analytics-test'
const courseIds: string[] = []
const teacherEmails: string[] = []
const promoCodeIds: string[] = []
const registrationIds: string[] = []

let slugCounter = 0
async function makeCourse(overrides: Partial<Parameters<typeof prisma.course.create>[0]['data']> = {}) {
  slugCounter += 1
  const slug = `${MARKER}-${Date.now()}-${slugCounter}`
  const course = await prisma.course.create({
    data: {
      name: slug,
      slug,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      isActive: true,
      feeAmount: 1000,
      currency: 'EGP',
      ...overrides,
    },
  })
  courseIds.push(course.id)
  return course
}

let teacherCounter = 0
async function makeTeacher() {
  teacherCounter += 1
  const email = `${MARKER}-${Date.now()}-${teacherCounter}@test.local`
  teacherEmails.push(email)
  return prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${teacherCounter}`,
      phone: `+2010000${teacherCounter}`,
      phoneNormalised: `+2010000${teacherCounter}`,
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
}

let codeCounter = 0
function randomCode(): string {
  codeCounter += 1
  return `ANALYTICSTEST${Date.now().toString(36)}${codeCounter}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
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

let refCounter = 0
async function makeRegistration(params: {
  courseId: string
  teacherId: string
  promoCodeId: string
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'
  originalFee: number
  discountAmount: number
  finalFee: number
}) {
  refCounter += 1
  const registration = await prisma.registration.create({
    data: {
      reference: `${MARKER}-${Date.now()}-${refCounter}`,
      teacherId: params.teacherId,
      courseId: params.courseId,
      courseNameSnapshot: 'x',
      courseDateSnapshot: new Date('2026-09-01T00:00:00.000Z'),
      courseFeeSnapshot: params.originalFee,
      courseCurrencySnapshot: 'EGP',
      status: params.status,
      emailType: params.status === 'CANCELLED' ? 'CONFIRMED' : params.status,
      promoCodeId: params.promoCodeId,
      promoCodeSnapshot: 'SNAPSHOT',
      discountTypeSnapshot: 'PERCENTAGE',
      discountValueSnapshot: 20,
      discountAmount: params.discountAmount,
      originalFee: params.originalFee,
      finalFee: params.finalFee,
      promoAppliedAt: new Date(),
      cancelledAt: params.status === 'CANCELLED' ? new Date() : null,
    },
  })
  registrationIds.push(registration.id)
  return registration
}

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.promoCodeCourse.deleteMany({ where: { promoCodeId: { in: promoCodeIds } } })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.$disconnect()
})

describe('getPromoCodeUsageAggregates', () => {
  it('per-code totals count only CONFIRMED registrations', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const teacherC = await makeTeacher()

    await makeRegistration({ courseId: course.id, teacherId: teacherA.id, promoCodeId: promo.id, status: 'CONFIRMED', originalFee: 1000, discountAmount: 200, finalFee: 800 })
    await makeRegistration({ courseId: course.id, teacherId: teacherB.id, promoCodeId: promo.id, status: 'WAITLISTED', originalFee: 1000, discountAmount: 200, finalFee: 800 })
    await makeRegistration({ courseId: course.id, teacherId: teacherC.id, promoCodeId: promo.id, status: 'CANCELLED', originalFee: 1000, discountAmount: 200, finalFee: 800 })

    const aggregates = await getPromoCodeUsageAggregates([promo.id])
    expect(aggregates.get(promo.id)?.totalUses).toBe(1)
  })

  it('total discount given sums the stored snapshot amounts, not recalculated values', async () => {
    const course = await makeCourse({ feeAmount: 1000 })
    // discountValue 20 on the code itself would compute to 200 if
    // recalculated — but the two registrations below carry different,
    // deliberately mismatched stored snapshot amounts, proving the sum
    // uses exactly what's stored.
    const promo = await makePromoCode({ discountValue: 20 })
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()

    await makeRegistration({ courseId: course.id, teacherId: teacherA.id, promoCodeId: promo.id, status: 'CONFIRMED', originalFee: 1000, discountAmount: 123.45, finalFee: 876.55 })
    await makeRegistration({ courseId: course.id, teacherId: teacherB.id, promoCodeId: promo.id, status: 'CONFIRMED', originalFee: 1000, discountAmount: 67.89, finalFee: 932.11 })

    const aggregates = await getPromoCodeUsageAggregates([promo.id])
    const totals = aggregates.get(promo.id)!
    expect(totals.totalDiscountGiven).toBe(191.34)
    expect(totals.potentialRegistrationValue).toBe(1808.66)
  })

  it('returns an empty map for an empty id list without querying', async () => {
    expect((await getPromoCodeUsageAggregates([])).size).toBe(0)
  })
})

describe('getPromoCodeDetail', () => {
  it('cancelled registrations appear in the detail list but are excluded from totals', async () => {
    const course = await makeCourse({ feeAmount: 1000 })
    const promo = await makePromoCode()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()

    await makeRegistration({ courseId: course.id, teacherId: teacherA.id, promoCodeId: promo.id, status: 'CONFIRMED', originalFee: 1000, discountAmount: 200, finalFee: 800 })
    await makeRegistration({ courseId: course.id, teacherId: teacherB.id, promoCodeId: promo.id, status: 'CANCELLED', originalFee: 1000, discountAmount: 200, finalFee: 800 })

    const detail = await getPromoCodeDetail(promo.id)
    expect(detail).not.toBeNull()
    expect(detail!.registrations).toHaveLength(2)
    expect(detail!.registrations.some((r) => r.status === 'CANCELLED')).toBe(true)
    expect(detail!.totalUses).toBe(1)
    expect(detail!.totalDiscountGiven).toBe(200)
    expect(detail!.potentialRegistrationValue).toBe(800)
  })

  it('returns null for a non-existent id', async () => {
    expect(await getPromoCodeDetail('does-not-exist')).toBeNull()
  })
})

describe('getPromoCodeDashboardSummary', () => {
  it('dashboard summary figures match the underlying records exactly', async () => {
    const course = await makeCourse({ feeAmount: 1000 })
    const promo = await makePromoCode()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()

    await makeRegistration({ courseId: course.id, teacherId: teacherA.id, promoCodeId: promo.id, status: 'CONFIRMED', originalFee: 1000, discountAmount: 100, finalFee: 900 })
    await makeRegistration({ courseId: course.id, teacherId: teacherB.id, promoCodeId: promo.id, status: 'CONFIRMED', originalFee: 1000, discountAmount: 150, finalFee: 850 })

    // getPromoCodeDashboardSummary is deliberately global/unfiltered (a
    // whole-system dashboard total), and this test database is shared with
    // every other test file running concurrently in the same run — so a
    // "snapshot before, snapshot after" delta across this test's own
    // multi-step setup is exactly the kind of window another worker's
    // writes can land in, and did in an earlier version of this test
    // (flaked on activeCodes). Instead, verify the summary against an
    // independent ground-truth query issued back-to-back with it, so the
    // two are only ever a few milliseconds apart rather than a whole test
    // body apart. This still proves "matches the underlying records
    // exactly" — it just measures the match at the narrowest possible
    // window instead of assuming a quiet database.
    const [summary, independentTotals] = await Promise.all([
      getPromoCodeDashboardSummary(),
      prisma.registration.aggregate({
        where: { promoCodeId: { not: null }, status: 'CONFIRMED' },
        _count: { _all: true },
        _sum: { discountAmount: true },
      }),
    ])

    expect(summary.totalUses).toBe(independentTotals._count._all)
    expect(summary.totalDiscountGiven).toBe(Math.round(Number(independentTotals._sum.discountAmount ?? 0) * 100) / 100)
    // My own two CONFIRMED registrations must be reflected somewhere in
    // this total, whatever else concurrent tests have added.
    expect(summary.totalUses).toBeGreaterThanOrEqual(2)
  })

  it('most used and highest value codes resolve correctly when a code clearly dominates the dataset', async () => {
    const course = await makeCourse({ feeAmount: 1000 })
    const dominant = await makePromoCode()

    const teacherCount = 10
    const teacherData = Array.from({ length: teacherCount }, (_, i) => ({
      emailNormalised: `${MARKER}-dominant-${Date.now()}-${i}@test.local`,
      emailOriginal: `${MARKER}-dominant-${Date.now()}-${i}@test.local`,
      fullName: `${MARKER} Dominant Teacher ${i}`,
      phone: `+2010001${i}`,
      phoneNormalised: `+2010001${i}`,
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    }))
    const teachers = await prisma.teacher.createManyAndReturn({ data: teacherData })
    teacherEmails.push(...teachers.map((t) => t.emailNormalised))

    // A use count and a potential value large enough to dominate any other
    // data already present in this shared test database.
    const registrationData = teachers.map((teacher, i) => ({
      reference: `${MARKER}-dominant-${Date.now()}-${i}`,
      teacherId: teacher.id,
      courseId: course.id,
      courseNameSnapshot: 'x',
      courseDateSnapshot: new Date('2026-09-01T00:00:00.000Z'),
      courseFeeSnapshot: 1000,
      courseCurrencySnapshot: 'EGP',
      status: 'CONFIRMED' as const,
      emailType: 'CONFIRMED' as const,
      promoCodeId: dominant.id,
      promoCodeSnapshot: dominant.code,
      discountTypeSnapshot: 'PERCENTAGE' as const,
      discountValueSnapshot: 20,
      discountAmount: 100,
      originalFee: 1000,
      finalFee: 999999,
      promoAppliedAt: new Date(),
    }))
    const created = await prisma.registration.createManyAndReturn({ data: registrationData })
    registrationIds.push(...created.map((r) => r.id))

    const summary = await getPromoCodeDashboardSummary()
    expect(summary.mostUsedCode?.code).toBe(dominant.code)
    expect(summary.mostUsedCode?.uses).toBe(teacherCount)
    expect(summary.highestValueCode?.code).toBe(dominant.code)
  }, 20_000)
})

describe('listAllPromoCodesForExport', () => {
  it('includes every promo code with its totals, unpaginated', async () => {
    const course = await makeCourse({ feeAmount: 1000 })
    const promo = await makePromoCode()
    const teacher = await makeTeacher()
    await makeRegistration({ courseId: course.id, teacherId: teacher.id, promoCodeId: promo.id, status: 'CONFIRMED', originalFee: 1000, discountAmount: 200, finalFee: 800 })

    const rows = await listAllPromoCodesForExport()
    const row = rows.find((r) => r.id === promo.id)
    expect(row).toBeDefined()
    expect(row!.useCount).toBe(1)
    expect(row!.totalDiscountGiven).toBe(200)
  })
})

describe('maxUsesPerTeacherScope column default', () => {
  it('a code created without specifying the scope defaults to ALL_COURSES — the same default the migration backfilled onto every pre-existing row', async () => {
    // maxUsesPerTeacherScope deliberately omitted — exercising the actual
    // database column default (NOT NULL DEFAULT 'ALL_COURSES'), which is
    // exactly the mechanism the migration relied on to backfill every
    // existing promo code with no data migration step of its own.
    const promo = await prisma.promoCode.create({
      data: { code: randomCode(), description: MARKER, discountType: 'PERCENTAGE', discountValue: 10, appliesToAllCourses: true },
    })
    promoCodeIds.push(promo.id)
    expect(promo.maxUsesPerTeacherScope).toBe('ALL_COURSES')
  })
})
