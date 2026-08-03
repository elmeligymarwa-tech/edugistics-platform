import { describe, it, expect } from 'vitest'
import { formatRelativeTime, formatDateTime } from './format'

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-03T12:00:00.000Z')

  it('reports very recent times as just now', () => {
    expect(formatRelativeTime('2026-08-03T11:59:55.000Z', now)).toBe('just now')
  })

  it('pluralises minutes correctly', () => {
    expect(formatRelativeTime('2026-08-03T11:59:00.000Z', now)).toBe('1 minute ago')
    expect(formatRelativeTime('2026-08-03T11:55:00.000Z', now)).toBe('5 minutes ago')
  })

  it('falls back to hours and days for older timestamps', () => {
    expect(formatRelativeTime('2026-08-03T09:00:00.000Z', now)).toBe('3 hours ago')
    expect(formatRelativeTime('2026-08-01T12:00:00.000Z', now)).toBe('2 days ago')
  })

  it('never reports a negative duration for clock skew', () => {
    expect(formatRelativeTime('2026-08-03T12:00:05.000Z', now)).toBe('just now')
  })
})

describe('formatDateTime', () => {
  it('formats using British English conventions', () => {
    expect(formatDateTime('2026-08-03T14:30:00.000Z')).toMatch(/3 Aug 2026/)
  })
})
