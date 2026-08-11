import { describe, expect, it } from 'vitest'

import {
  formatCourseDateLong,
  formatCourseDateOrSessions,
  formatCourseSessionList,
  parseDateInputValue,
  toDateInputValue,
} from './format'

describe('formatCourseSessionList', () => {
  it('lists dates within the same month exactly as specified', () => {
    const dates = [
      new Date('2026-09-05T00:00:00.000Z'),
      new Date('2026-09-12T00:00:00.000Z'),
      new Date('2026-09-19T00:00:00.000Z'),
      new Date('2026-09-26T00:00:00.000Z'),
    ]
    expect(formatCourseSessionList(dates)).toBe('5, 12, 19 and 26 September 2026, 4 sessions')
  })

  it('names the month on any date that crosses a month boundary within the same year', () => {
    const dates = [new Date('2026-08-30T00:00:00.000Z'), new Date('2026-09-02T00:00:00.000Z')]
    expect(formatCourseSessionList(dates)).toBe('30 August and 2 September 2026, 2 sessions')
  })

  it('names the year on any date that crosses a year boundary', () => {
    const dates = [new Date('2026-12-30T00:00:00.000Z'), new Date('2027-01-02T00:00:00.000Z')]
    expect(formatCourseSessionList(dates)).toBe('30 December 2026 and 2 January 2027, 2 sessions')
  })

  it('sorts unsorted input before formatting', () => {
    const dates = [new Date('2026-09-19T00:00:00.000Z'), new Date('2026-09-05T00:00:00.000Z')]
    expect(formatCourseSessionList(dates)).toBe('5 and 19 September 2026, 2 sessions')
  })

  it('switches to a first-to-last summary beyond the listing threshold', () => {
    const dates = [
      new Date('2026-09-05T00:00:00.000Z'),
      new Date('2026-09-12T00:00:00.000Z'),
      new Date('2026-09-19T00:00:00.000Z'),
      new Date('2026-09-26T00:00:00.000Z'),
      new Date('2026-10-03T00:00:00.000Z'),
      new Date('2026-10-10T00:00:00.000Z'),
    ]
    expect(formatCourseSessionList(dates)).toBe('5 September to 10 October 2026, 6 sessions')
  })
})

describe('parseDateInputValue', () => {
  it('parses a complete, valid date input value', () => {
    const result = parseDateInputValue('2026-03-15')
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString().slice(0, 10)).toBe('2026-03-15')
  })

  it('returns undefined, never throws, for an empty string (a native date input mid-typing)', () => {
    expect(parseDateInputValue('')).toBeUndefined()
  })

  it('returns undefined, never throws, for a value that does not parse to a real date', () => {
    expect(parseDateInputValue('not-a-date')).toBeUndefined()
  })
})

describe('toDateInputValue', () => {
  it('formats a valid Date back into the yyyy-mm-dd input value', () => {
    expect(toDateInputValue(new Date('2026-03-15T00:00:00.000Z'))).toBe('2026-03-15')
  })

  it('returns an empty string, never throws, for undefined', () => {
    expect(toDateInputValue(undefined)).toBe('')
  })

  it('returns an empty string, never throws, for null', () => {
    expect(toDateInputValue(null)).toBe('')
  })

  it('returns an empty string, never throws, for an Invalid Date', () => {
    expect(toDateInputValue(new Date('not-a-date'))).toBe('')
  })

  it('round-trips through parseDateInputValue back to the same input value', () => {
    const value = '2026-12-01'
    expect(toDateInputValue(parseDateInputValue(value))).toBe(value)
  })
})

describe('formatCourseDateOrSessions', () => {
  it('falls back to the plain single-day format when isMultiDay is false, regardless of sessions', () => {
    const courseDate = new Date('2026-08-10T00:00:00.000Z')
    expect(formatCourseDateOrSessions({ courseDate, isMultiDay: false, sessions: [] })).toBe(formatCourseDateLong(courseDate))
  })

  it('uses the session list format when isMultiDay is true and sessions are present', () => {
    const courseDate = new Date('2026-09-05T00:00:00.000Z')
    const sessions = [courseDate, new Date('2026-09-12T00:00:00.000Z')]
    expect(formatCourseDateOrSessions({ courseDate, isMultiDay: true, sessions })).toBe('5 and 12 September 2026, 2 sessions')
  })
})
