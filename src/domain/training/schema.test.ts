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
  it('accepts a single-day course exactly as before: courseDate, duration, no endDate', () => {
    const result = courseFormSchema.safeParse({ ...baseCourse, durationMinutes: 60 })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.isMultiDay).toBe(false)
    expect(result.data.endDate).toBeNull()
    expect(result.data.durationMinutes).toBe(60)
  })

  it('rejects a single-day course missing durationMinutes', () => {
    const result = courseFormSchema.safeParse({ ...baseCourse, durationMinutes: null })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'durationMinutes')).toBe(true)
  })

  it('rejects a single-day course that also carries an endDate', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      durationMinutes: 60,
      endDate: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'endDate')).toBe(true)
  })
})

describe('courseFormSchema — multi-day', () => {
  it('accepts a multi-day course: courseDate as start, endDate on or after it, no durationMinutes', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: null,
      endDate: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.isMultiDay).toBe(true)
    expect(result.data.endDate).toEqual(new Date('2026-09-15T00:00:00.000Z'))
    expect(result.data.durationMinutes).toBeNull()
  })

  it('accepts endDate equal to courseDate (a 1-day "range")', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: null,
      endDate: baseCourse.courseDate,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an end date before the start date', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: null,
      endDate: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'endDate')).toBe(true)
  })

  it('rejects a multi-day course missing an endDate', () => {
    const result = courseFormSchema.safeParse({ ...baseCourse, isMultiDay: true, durationMinutes: null })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'endDate')).toBe(true)
  })

  it('rejects a multi-day course that also carries a durationMinutes value', () => {
    const result = courseFormSchema.safeParse({
      ...baseCourse,
      isMultiDay: true,
      durationMinutes: 60,
      endDate: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'durationMinutes')).toBe(true)
  })
})
