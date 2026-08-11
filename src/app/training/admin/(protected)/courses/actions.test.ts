import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))

const { createCourseAction, updateCourseAction } = await import('./actions')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning, hitting the real database like the
// other course/registration action suites.
const MARKER = 'course-actions-test'
const courseIds: string[] = []

afterAll(async () => {
  // CourseSession rows cascade-delete with their Course (onDelete: Cascade
  // in schema.prisma), so no separate cleanup is needed for them.
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

function getSessions(courseId: string) {
  return prisma.courseSession.findMany({ where: { courseId }, orderBy: { sessionDate: 'asc' } })
}

describe('createCourseAction — single-day (unaffected by multi-day support)', () => {
  it('saves and reads back exactly as before: courseDate, duration, no sessions, isMultiDay false', async () => {
    const result = await createCourseAction({ ...baseInput, durationMinutes: 60 })
    expect(result.success).toBe(true)
    if (!result.success) return
    courseIds.push(result.data.id)

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: result.data.id } })
    expect(saved.isMultiDay).toBe(false)
    expect(saved.durationMinutes).toBe(60)
    expect(saved.courseDate.toISOString()).toBe(baseInput.courseDate.toISOString())
    expect(await getSessions(result.data.id)).toHaveLength(0)
  })
})

describe('createCourseAction — multi-day', () => {
  it('saves four non-consecutive dates, ignoring a mismatched isMultiDay claim', async () => {
    const sessionDates = [
      new Date('2026-09-05T00:00:00.000Z'),
      new Date('2026-09-19T00:00:00.000Z'),
      new Date('2026-10-03T00:00:00.000Z'),
      new Date('2026-10-17T00:00:00.000Z'),
    ]
    const result = await createCourseAction({
      ...baseInput,
      // Deliberately wrong — the server derives isMultiDay from
      // sessionDates, not from this field.
      isMultiDay: true,
      durationMinutes: null,
      sessionDates,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    courseIds.push(result.data.id)

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: result.data.id } })
    expect(saved.isMultiDay).toBe(true)
    expect(saved.durationMinutes).toBeNull()
    // courseDate resolves to the earliest session date, not the (unused) courseDate field on the payload.
    expect(saved.courseDate.toISOString()).toBe(sessionDates[0]!.toISOString())

    const sessions = await getSessions(result.data.id)
    expect(sessions).toHaveLength(4)
    expect(sessions.map((s) => s.sessionDate.toISOString())).toEqual(sessionDates.map((d) => d.toISOString()))
  })

  it('handles dates spanning more than one month', async () => {
    const sessionDates = [new Date('2026-08-30T00:00:00.000Z'), new Date('2026-09-02T00:00:00.000Z')]
    const result = await createCourseAction({ ...baseInput, isMultiDay: true, durationMinutes: null, sessionDates })
    expect(result.success).toBe(true)
    if (!result.success) return
    courseIds.push(result.data.id)

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: result.data.id } })
    expect(saved.courseDate.toISOString()).toBe(sessionDates[0]!.toISOString())
    expect(await getSessions(result.data.id)).toHaveLength(2)
  })

  it('rejects a duplicate session date, saving nothing', async () => {
    const date = new Date('2026-09-05T00:00:00.000Z')
    const result = await createCourseAction({
      ...baseInput,
      isMultiDay: true,
      durationMinutes: null,
      sessionDates: [date, new Date('2026-09-12T00:00:00.000Z'), new Date(date)],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.fieldErrors?.sessionDates).toBeDefined()
  })

  it('rejects a multi-day course with fewer than two session dates, saving nothing', async () => {
    const result = await createCourseAction({
      ...baseInput,
      isMultiDay: true,
      durationMinutes: null,
      sessionDates: [new Date('2026-09-05T00:00:00.000Z')],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.fieldErrors?.sessionDates).toBeDefined()
  })

  it('rejects a multi-day course that also carries a duration in minutes, saving nothing', async () => {
    const result = await createCourseAction({
      ...baseInput,
      isMultiDay: true,
      durationMinutes: 60,
      sessionDates: [new Date('2026-09-05T00:00:00.000Z'), new Date('2026-09-12T00:00:00.000Z')],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.fieldErrors?.durationMinutes).toBeDefined()
  })
})

describe('updateCourseAction — multi-day session removal', () => {
  it('removing a session date updates the count and the derived courseDate', async () => {
    const created = await createCourseAction({
      ...baseInput,
      isMultiDay: true,
      durationMinutes: null,
      sessionDates: [
        new Date('2026-09-05T00:00:00.000Z'),
        new Date('2026-09-12T00:00:00.000Z'),
        new Date('2026-09-19T00:00:00.000Z'),
      ],
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    courseIds.push(created.data.id)

    // Remove the earliest date — the two remaining dates stay, and the
    // derived courseDate must move to the new earliest.
    const updated = await updateCourseAction(created.data.id, {
      ...baseInput,
      isMultiDay: true,
      durationMinutes: null,
      sessionDates: [new Date('2026-09-12T00:00:00.000Z'), new Date('2026-09-19T00:00:00.000Z')],
    })
    expect(updated.success).toBe(true)
    if (!updated.success) return

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: updated.data.id } })
    expect(saved.courseDate.toISOString()).toBe(new Date('2026-09-12T00:00:00.000Z').toISOString())

    const sessions = await getSessions(updated.data.id)
    expect(sessions).toHaveLength(2)
    expect(sessions.map((s) => s.sessionDate.toISOString())).toEqual(
      [new Date('2026-09-12T00:00:00.000Z'), new Date('2026-09-19T00:00:00.000Z')].map((d) => d.toISOString()),
    )
  })
})
