import { describe, expect, it } from 'vitest'

import { courseDayCount, formatCourseDateLong, formatCourseDateOrRange, formatCourseDateRange } from './format'

describe('courseDayCount', () => {
  it('counts a same-day range as 1 day', () => {
    const date = new Date('2026-09-12T00:00:00.000Z')
    expect(courseDayCount(date, date)).toBe(1)
  })

  it('counts inclusively within a month', () => {
    expect(courseDayCount(new Date('2026-09-12T00:00:00.000Z'), new Date('2026-09-15T00:00:00.000Z'))).toBe(4)
  })

  it('counts correctly across a month boundary', () => {
    // 30, 31 August, 1, 2 September — 4 days.
    expect(courseDayCount(new Date('2026-08-30T00:00:00.000Z'), new Date('2026-09-02T00:00:00.000Z'))).toBe(4)
  })

  it('counts correctly across a year boundary', () => {
    // 30, 31 December, 1, 2 January — 4 days.
    expect(courseDayCount(new Date('2026-12-30T00:00:00.000Z'), new Date('2027-01-02T00:00:00.000Z'))).toBe(4)
  })
})

describe('formatCourseDateRange', () => {
  it('formats a range within the same month exactly as specified', () => {
    expect(formatCourseDateRange(new Date('2026-09-12T00:00:00.000Z'), new Date('2026-09-15T00:00:00.000Z'))).toBe(
      '12 to 15 September 2026, 4 days',
    )
  })

  it('names the start month when the range crosses a month boundary within the same year', () => {
    expect(formatCourseDateRange(new Date('2026-08-30T00:00:00.000Z'), new Date('2026-09-02T00:00:00.000Z'))).toBe(
      '30 August to 2 September 2026, 4 days',
    )
  })

  it('names the start year when the range crosses a year boundary', () => {
    expect(formatCourseDateRange(new Date('2026-12-30T00:00:00.000Z'), new Date('2027-01-02T00:00:00.000Z'))).toBe(
      '30 December 2026 to 2 January 2027, 4 days',
    )
  })

  it('uses singular "day" for a same-day range', () => {
    const date = new Date('2026-09-12T00:00:00.000Z')
    expect(formatCourseDateRange(date, date)).toBe('12 to 12 September 2026, 1 day')
  })
})

describe('formatCourseDateOrRange', () => {
  it('falls back to the plain single-day format when isMultiDay is false, regardless of endDate', () => {
    const courseDate = new Date('2026-08-10T00:00:00.000Z')
    expect(formatCourseDateOrRange({ courseDate, endDate: null, isMultiDay: false })).toBe(formatCourseDateLong(courseDate))
  })

  it('uses the range format when isMultiDay is true and endDate is present', () => {
    const courseDate = new Date('2026-09-12T00:00:00.000Z')
    const endDate = new Date('2026-09-15T00:00:00.000Z')
    expect(formatCourseDateOrRange({ courseDate, endDate, isMultiDay: true })).toBe('12 to 15 September 2026, 4 days')
  })
})
