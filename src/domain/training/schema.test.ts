import { describe, expect, it } from 'vitest'

import { courseFormSchema } from './schema'

const baseCourse = {
  name: 'Test Course',
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

describe('courseFormSchema — single-day (unaffected by multi-day support)', () => {
  it('accepts a single-day course exactly as before: courseDate, duration, no session dates', () => {
    const result = courseFormSchema.safeParse({ ...baseCourse, durationMinutes: 60 })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.isMultiDay).toBe(false)
    expect(result.data.sessionDates).toEqual([])
    expect(result.data.durationMinutes).toBe(60)
  })

  it('rejects a single-day course missing durationMinutes', () => {
    const result = courseFormSchema.safeParse({ ...baseCourse, durationMinutes: null })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'durationMinutes')).toBe(true)
  })

  it('rejects a single-day course that also carries session dates', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      durationMinutes: 60,
      sessionDates: [new Date('2026-09-15T00:00:00.000Z')],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'sessionDates')).toBe(true)
  })
})

describe('courseFormSchema — multi-day', () => {
  it('accepts four non-consecutive dates spanning more than one month, no durationMinutes', () => {
    const sessionDates = [
      new Date('2026-09-05T00:00:00.000Z'),
      new Date('2026-09-19T00:00:00.000Z'),
      new Date('2026-10-03T00:00:00.000Z'),
      new Date('2026-10-17T00:00:00.000Z'),
    ]
    const result = courseFormSchema.safeParse({ ...baseCourse, isMultiDay: true, durationMinutes: null, sessionDates })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.isMultiDay).toBe(true)
    expect(result.data.sessionDates).toHaveLength(4)
    expect(result.data.durationMinutes).toBeNull()
  })

  it('accepts exactly two session dates (the minimum)', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: null,
      sessionDates: [new Date('2026-09-05T00:00:00.000Z'), new Date('2026-09-12T00:00:00.000Z')],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a duplicate session date', () => {
    const date = new Date('2026-09-05T00:00:00.000Z')
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: null,
      sessionDates: [date, new Date('2026-09-12T00:00:00.000Z'), new Date(date)],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'sessionDates')).toBe(true)
  })

  it('rejects a multi-day course with fewer than two session dates', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: null,
      sessionDates: [new Date('2026-09-05T00:00:00.000Z')],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'sessionDates')).toBe(true)
  })

  it('rejects a multi-day course with no session dates at all', () => {
    const result = courseFormSchema.safeParse({ ...baseCourse, isMultiDay: true, durationMinutes: null })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'sessionDates')).toBe(true)
  })

  it('rejects a multi-day course that also carries a durationMinutes value', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: 60,
      sessionDates: [new Date('2026-09-05T00:00:00.000Z'), new Date('2026-09-12T00:00:00.000Z')],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'durationMinutes')).toBe(true)
  })
})
