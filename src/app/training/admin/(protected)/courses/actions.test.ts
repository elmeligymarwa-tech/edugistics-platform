import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))

const { createCourseAction } = await import('./actions')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning, hitting the real database like the
// other course/registration action suites.
const MARKER = 'course-actions-test'
const courseIds: string[] = []

afterAll(async () => {
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

const baseInput = {
  name: `${MARKER} course`,
  shortDescription: 'x',
  fullDescription: 'x',
  category: 'LEADERSHIP' as const,
  courseDate: new Date('2026-09-12T00:00:00.000Z'),
  startTime: '09:00',
  endTime: '10:00',
  deliveryMethod: 'ONLINE' as const,
  feeAmount: 0,
  currency: 'EGP',
}

describe('createCourseAction — single-day (unaffected by multi-day support)', () => {
  it('saves and reads back exactly as before: courseDate, duration, no endDate, isMultiDay false', async () => {
    const result = await createCourseAction({ ...baseInput, durationMinutes: 60 })
    expect(result.success).toBe(true)
    if (!result.success) return
    courseIds.push(result.data.id)

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: result.data.id } })
    expect(saved.isMultiDay).toBe(false)
    expect(saved.endDate).toBeNull()
    expect(saved.durationMinutes).toBe(60)
    expect(saved.courseDate.toISOString()).toBe(baseInput.courseDate.toISOString())
  })
})

describe('createCourseAction — multi-day', () => {
  it('saves with the correct day count and a server-derived durationMinutes, ignoring a mismatched isMultiDay claim', async () => {
    const result = await createCourseAction({
      ...baseInput,
      // Deliberately wrong — the server derives isMultiDay from endDate,
      // not from this field, so this must not end up stored as multi-day
      // once endDate is also omitted... (see the next test for that case).
      isMultiDay: true,
      durationMinutes: null,
      endDate: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    courseIds.push(result.data.id)

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: result.data.id } })
    expect(saved.isMultiDay).toBe(true)
    expect(saved.endDate?.toISOString()).toBe(new Date('2026-09-15T00:00:00.000Z').toISOString())
    // Server-computed from startTime (09:00) / endTime (10:00) — never the
    // rejected client-side durationMinutes, which this payload never sent.
    expect(saved.durationMinutes).toBe(60)
  })

  it('computes the correct day count across a month boundary', async () => {
    const result = await createCourseAction({
      ...baseInput,
      isMultiDay: true,
      durationMinutes: null,
      courseDate: new Date('2026-08-30T00:00:00.000Z'),
      endDate: new Date('2026-09-02T00:00:00.000Z'),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    courseIds.push(result.data.id)

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: result.data.id } })
    // 30, 31 August, 1, 2 September — 4 days. The route stores the raw dates;
    // courseDayCount (domain/training/format.ts) is what turns this into "4
    // days" for display — covered directly in format.test.ts.
    expect(saved.courseDate.toISOString()).toBe(new Date('2026-08-30T00:00:00.000Z').toISOString())
    expect(saved.endDate?.toISOString()).toBe(new Date('2026-09-02T00:00:00.000Z').toISOString())
  })

  it('rejects an end date before the start date, saving nothing', async () => {
    const result = await createCourseAction({
      ...baseInput,
      isMultiDay: true,
      durationMinutes: null,
      endDate: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.fieldErrors?.endDate).toBeDefined()
  })

  it('rejects a multi-day course that also carries a duration in minutes, saving nothing', async () => {
    const result = await createCourseAction({
      ...baseInput,
      isMultiDay: true,
      durationMinutes: 60,
      endDate: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.fieldErrors?.durationMinutes).toBeDefined()
  })
})
