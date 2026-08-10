import { describe, expect, it } from 'vitest'

import { parseSubscriberSearchParams, parseSubscriberSort } from './subscriber-filters'

describe('parseSubscriberSearchParams', () => {
  it('defaults status to SUBSCRIBED when the URL says nothing', () => {
    const filters = parseSubscriberSearchParams({})
    expect(filters.status).toBe('SUBSCRIBED')
  })

  it('accepts an explicit switch to ALL or UNSUBSCRIBED', () => {
    expect(parseSubscriberSearchParams({ status: 'ALL' }).status).toBe('ALL')
    expect(parseSubscriberSearchParams({ status: 'UNSUBSCRIBED' }).status).toBe('UNSUBSCRIBED')
  })

  it('falls back to SUBSCRIBED for a garbage status value rather than leaving it unfiltered', () => {
    expect(parseSubscriberSearchParams({ status: 'nonsense' }).status).toBe('SUBSCRIBED')
  })

  it('parses search, school, subject, grade, course and source', () => {
    const filters = parseSubscriberSearchParams({
      q: 'jane',
      schoolId: 'school-1',
      subject: 'mathematics',
      grade: 'grade 3',
      courseId: 'course-1',
      source: 'ADMIN_MANUAL',
    })
    expect(filters.search).toBe('jane')
    expect(filters.schoolId).toBe('school-1')
    expect(filters.subject).toBe('mathematics')
    expect(filters.grade).toBe('grade 3')
    expect(filters.consentCourseId).toBe('course-1')
    expect(filters.source).toBe('ADMIN_MANUAL')
  })

  it('ignores an invalid source value', () => {
    expect(parseSubscriberSearchParams({ source: 'nonsense' }).source).toBeUndefined()
  })

  it('parses from/to as Cairo-local day boundaries', () => {
    const filters = parseSubscriberSearchParams({ from: '2026-03-01', to: '2026-03-31' })
    expect(filters.dateFrom).toBeInstanceOf(Date)
    expect(filters.dateTo).toBeInstanceOf(Date)
    expect(filters.dateFrom!.getTime()).toBeLessThan(filters.dateTo!.getTime())
  })
})

describe('parseSubscriberSort', () => {
  it('defaults to subscribedAt desc', () => {
    expect(parseSubscriberSort({})).toEqual({ sortField: 'subscribedAt', sortDir: 'desc' })
  })

  it('accepts an explicit field and direction', () => {
    expect(parseSubscriberSort({ sortField: 'name', sortDir: 'asc' })).toEqual({ sortField: 'name', sortDir: 'asc' })
    expect(parseSubscriberSort({ sortField: 'emailsSent', sortDir: 'asc' })).toEqual({ sortField: 'emailsSent', sortDir: 'asc' })
  })

  it('falls back to subscribedAt for an unrecognised field', () => {
    expect(parseSubscriberSort({ sortField: 'nonsense' }).sortField).toBe('subscribedAt')
  })
})
