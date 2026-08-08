import { describe, expect, it } from 'vitest'

import { generateRegistrationReference } from './reference'

describe('generateRegistrationReference', () => {
  it('matches EDU-YYYY-XXXXXX with six uppercase alphanumeric characters', () => {
    const reference = generateRegistrationReference(new Date('2026-03-14T12:00:00Z'))
    expect(reference).toMatch(/^EDU-\d{4}-[A-Z0-9]{6}$/)
  })

  it('uses the Cairo calendar year, not the UTC year, near midnight', () => {
    // 2025-12-31T23:30 UTC is already 2026-01-01 in Cairo (UTC+2).
    const reference = generateRegistrationReference(new Date('2025-12-31T23:30:00Z'))
    expect(reference.startsWith('EDU-2026-')).toBe(true)
  })

  it('produces different suffixes across calls', () => {
    const now = new Date('2026-03-14T12:00:00Z')
    const references = new Set(Array.from({ length: 20 }, () => generateRegistrationReference(now)))
    expect(references.size).toBeGreaterThan(1)
  })
})
