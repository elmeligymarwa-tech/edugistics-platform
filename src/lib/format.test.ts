import { describe, it, expect } from 'vitest'
import {
  formatRelativeTime,
  formatDateTime,
  formatMoney,
  formatCompactMoney,
  formatMoneySigned,
  formatCompactMoneySigned,
} from './format'

const egp = { currencyCode: 'EGP', decimalPlaces: 0, locale: 'en-GB' }

describe('formatMoney', () => {
  it('renders the three-letter currency code, not a symbol', () => {
    expect(formatMoney(11_000_000, egp).text).toBe('EGP 11,000,000')
  })

  it('renders a loss in brackets with no minus sign, and flags it negative', () => {
    const result = formatMoney(-11_417_000, egp)
    expect(result.text).toBe('EGP (11,417,000)')
    expect(result.text).not.toContain('-')
    expect(result.negative).toBe(true)
  })

  it('does not flag a positive value as negative', () => {
    expect(formatMoney(11_417_000, egp).negative).toBe(false)
  })
})

describe('formatCompactMoney', () => {
  it('uses the same currency code as formatMoney', () => {
    expect(formatCompactMoney(11_000_000, egp).text).toBe('EGP 11.0m')
    expect(formatCompactMoney(4_200, egp).text).toBe('EGP 4k')
  })

  it('renders a compact loss in brackets with no minus sign', () => {
    const result = formatCompactMoney(-11_417_000, egp)
    expect(result.text).toBe('EGP (11.4m)')
    expect(result.text).not.toContain('-')
    expect(result.negative).toBe(true)
  })

  it('falls back to the full body below the compacting threshold', () => {
    expect(formatCompactMoney(950, egp)).toEqual(formatMoney(950, egp))
    expect(formatCompactMoney(-950, egp)).toEqual(formatMoney(-950, egp))
  })
})

describe('formatMoneySigned', () => {
  it('keeps a minus sign and no brackets for CSV/plain-text contexts', () => {
    expect(formatMoneySigned(-11_417_000, egp)).toBe('-EGP 11,417,000')
    expect(formatMoneySigned(11_417_000, egp)).toBe('EGP 11,417,000')
  })
})

describe('formatCompactMoneySigned', () => {
  it('keeps a minus sign and no brackets for chart axis ticks', () => {
    expect(formatCompactMoneySigned(-11_417_000, egp)).toBe('-EGP 11.4m')
    expect(formatCompactMoneySigned(11_417_000, egp)).toBe('EGP 11.4m')
  })
})

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
