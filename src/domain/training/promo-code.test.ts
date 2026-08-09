import { describe, expect, it } from 'vitest'

import {
  countPromoCodeUses,
  derivePromoCodeStatus,
  isValidPromoCodeFormat,
  normalisePromoCode,
  resolveCourseIds,
} from './promo-code'
import { cairoDateTimeLocalToUtc } from './timezone'

describe('normalisePromoCode', () => {
  it('resolves edu20, Edu20 and EDU20 to the same stored code', () => {
    expect(normalisePromoCode('edu20')).toBe('EDU20')
    expect(normalisePromoCode('Edu20')).toBe('EDU20')
    expect(normalisePromoCode('EDU20')).toBe('EDU20')
    expect(normalisePromoCode('edu20')).toBe(normalisePromoCode('Edu20'))
    expect(normalisePromoCode('Edu20')).toBe(normalisePromoCode('EDU20'))
  })

  it('trims surrounding whitespace', () => {
    expect(normalisePromoCode('  edu20  ')).toBe('EDU20')
  })
})

describe('isValidPromoCodeFormat', () => {
  it('accepts letters and digits only', () => {
    expect(isValidPromoCodeFormat('EDU20')).toBe(true)
    expect(isValidPromoCodeFormat('WEBINAR2026')).toBe(true)
  })

  it('rejects whitespace and characters outside A-Z0-9', () => {
    expect(isValidPromoCodeFormat('EDU 20')).toBe(false)
    expect(isValidPromoCodeFormat('EDU-20')).toBe(false)
    expect(isValidPromoCodeFormat('EDU_20')).toBe(false)
    expect(isValidPromoCodeFormat('ÉDU20')).toBe(false)
  })
})

describe('resolveCourseIds', () => {
  it('selecting all courses clears any individually selected courses', () => {
    expect(resolveCourseIds(true, ['course-1', 'course-2'])).toEqual([])
  })

  it('keeps the selected courses when appliesToAllCourses is false', () => {
    expect(resolveCourseIds(false, ['course-1', 'course-2'])).toEqual(['course-1', 'course-2'])
  })
})

describe('countPromoCodeUses', () => {
  it('counts only CONFIRMED registrations', () => {
    const registrations = [
      { status: 'CONFIRMED' as const },
      { status: 'CONFIRMED' as const },
      { status: 'WAITLISTED' as const },
      { status: 'CANCELLED' as const },
    ]
    expect(countPromoCodeUses(registrations)).toBe(2)
  })

  it('a WAITLISTED registration never consumes a use', () => {
    expect(countPromoCodeUses([{ status: 'WAITLISTED' }])).toBe(0)
  })

  it('a CANCELLED registration does not count — its use is released back to the pool', () => {
    expect(countPromoCodeUses([{ status: 'CANCELLED' }])).toBe(0)
  })

  it('returns 0 for no registrations', () => {
    expect(countPromoCodeUses([])).toBe(0)
  })
})

describe('derivePromoCodeStatus', () => {
  const now = new Date('2026-06-15T12:00:00.000Z')

  const baseline = {
    archivedAt: null,
    isPaused: false,
    startsAt: null,
    expiresAt: null,
    maxTotalUses: null,
    currentUseCount: 0,
  }

  it('returns SCHEDULED before the start date', () => {
    const status = derivePromoCodeStatus({ ...baseline, startsAt: new Date('2026-07-01T00:00:00.000Z') }, now)
    expect(status).toBe('SCHEDULED')
  })

  it('returns EXPIRED after the expiry date', () => {
    const status = derivePromoCodeStatus({ ...baseline, expiresAt: new Date('2026-06-01T00:00:00.000Z') }, now)
    expect(status).toBe('EXPIRED')
  })

  it('returns PAUSED when paused, taking precedence over dates', () => {
    const status = derivePromoCodeStatus(
      { ...baseline, isPaused: true, expiresAt: new Date('2026-06-01T00:00:00.000Z'), startsAt: new Date('2026-07-01T00:00:00.000Z') },
      now,
    )
    expect(status).toBe('PAUSED')
  })

  it('returns ARCHIVED regardless of other conditions', () => {
    const status = derivePromoCodeStatus(
      {
        ...baseline,
        archivedAt: new Date('2026-01-01T00:00:00.000Z'),
        isPaused: true,
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        startsAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      now,
    )
    expect(status).toBe('ARCHIVED')
  })

  it('returns EXHAUSTED once the use count reaches maxTotalUses', () => {
    const status = derivePromoCodeStatus({ ...baseline, maxTotalUses: 5, currentUseCount: 5 }, now)
    expect(status).toBe('EXHAUSTED')
  })

  it('returns ACTIVE when none of the above apply', () => {
    const status = derivePromoCodeStatus(baseline, now)
    expect(status).toBe('ACTIVE')
  })

  it('uses Africa/Cairo for date comparisons — a code expiring at midnight Cairo behaves correctly around that exact boundary', () => {
    // Expiry resolved exactly the way the form schema resolves an admin-entered
    // expiry date: end of 15 June in Africa/Cairo, not end of 15 June UTC.
    const expiresAt = cairoDateTimeLocalToUtc('2026-06-15T23:59:59.999')
    const oneSecondBefore = new Date(expiresAt.getTime() - 1000)
    const oneSecondAfter = new Date(expiresAt.getTime() + 1000)

    expect(derivePromoCodeStatus({ ...baseline, expiresAt }, oneSecondBefore)).toBe('ACTIVE')
    expect(derivePromoCodeStatus({ ...baseline, expiresAt }, oneSecondAfter)).toBe('EXPIRED')

    // Proves this is genuinely Cairo-resolved, not a pass-through of the literal string as
    // if it were already UTC — Cairo is never UTC+0, so the two instants must differ.
    const naiveUtcInstant = new Date('2026-06-15T23:59:59.999Z')
    expect(expiresAt.getTime()).not.toBe(naiveUtcInstant.getTime())
  })
})
