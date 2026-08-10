import { describe, expect, it } from 'vitest'

import {
  applyPromoDiscount,
  countPromoCodeUses,
  derivePromoCodeStatus,
  formatPromoDiscountLabel,
  isBetterPromoCodeRanking,
  isValidPromoCodeFormat,
  normalisePromoCode,
  promoCodeStatusRejectionMessage,
  remainingPromoCodeUses,
  resolveCourseIds,
  roundToTwoDecimals,
  summarisePromoCodeUsage,
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

describe('applyPromoDiscount', () => {
  it('a valid percentage discount produces the correct final fee', () => {
    const result = applyPromoDiscount(2000, 'PERCENTAGE', 20)
    expect(result.discountAmount).toBe(400)
    expect(result.finalFee).toBe(1600)
  })

  it('a valid fixed amount discount produces the correct final fee', () => {
    const result = applyPromoDiscount(1000, 'FIXED_AMOUNT', 50)
    expect(result.discountAmount).toBe(50)
    expect(result.finalFee).toBe(950)
  })

  it('a fixed discount larger than the course fee clamps the final fee to zero, never negative', () => {
    const result = applyPromoDiscount(100, 'FIXED_AMOUNT', 500)
    expect(result.discountAmount).toBe(100)
    expect(result.finalFee).toBe(0)
  })

  it('a percentage discount can reach exactly 100% without going negative', () => {
    const result = applyPromoDiscount(500, 'PERCENTAGE', 100)
    expect(result.discountAmount).toBe(500)
    expect(result.finalFee).toBe(0)
  })

  it('rounds to two decimal places, round-half-up', () => {
    const result = applyPromoDiscount(99.99, 'PERCENTAGE', 33)
    // 99.99 * 33 / 100 = 32.9967 -> 33.00
    expect(result.discountAmount).toBe(33)
    expect(result.finalFee).toBe(66.99)
  })
})

describe('roundToTwoDecimals', () => {
  it('rounds half up to two decimal places', () => {
    expect(roundToTwoDecimals(1.005)).toBe(1.01)
    expect(roundToTwoDecimals(1.004)).toBe(1)
    expect(roundToTwoDecimals(10)).toBe(10)
  })
})

describe('formatPromoDiscountLabel', () => {
  it('formats a percentage discount as a plain percentage', () => {
    expect(formatPromoDiscountLabel('PERCENTAGE', 20, 'EGP')).toBe('20%')
  })

  it('formats a fixed amount discount with its currency', () => {
    expect(formatPromoDiscountLabel('FIXED_AMOUNT', 50, 'EGP')).toBe('EGP 50')
  })
})

describe('promoCodeStatusRejectionMessage', () => {
  it('returns the exact required wording for each non-ACTIVE status', () => {
    expect(promoCodeStatusRejectionMessage('EXPIRED')).toBe('This promo code has expired.')
    expect(promoCodeStatusRejectionMessage('SCHEDULED')).toBe('This promo code is not yet available.')
    expect(promoCodeStatusRejectionMessage('PAUSED')).toBe('This promo code is no longer available.')
    expect(promoCodeStatusRejectionMessage('EXHAUSTED')).toBe('This promo code has reached its usage limit.')
    expect(promoCodeStatusRejectionMessage('ARCHIVED')).toBe('Invalid promo code.')
  })
})

describe('summarisePromoCodeUsage', () => {
  it('per-code totals count only CONFIRMED registrations', () => {
    const totals = summarisePromoCodeUsage([
      { status: 'CONFIRMED', discountAmount: 100, finalFee: 900 },
      { status: 'CONFIRMED', discountAmount: 200, finalFee: 800 },
      { status: 'WAITLISTED', discountAmount: 50, finalFee: 950 },
      { status: 'CANCELLED', discountAmount: 300, finalFee: 700 },
    ])
    expect(totals.totalUses).toBe(2)
  })

  it('cancelled and waitlisted registrations are excluded from every total', () => {
    const totals = summarisePromoCodeUsage([
      { status: 'WAITLISTED', discountAmount: 50, finalFee: 950 },
      { status: 'CANCELLED', discountAmount: 300, finalFee: 700 },
    ])
    expect(totals).toEqual({ totalUses: 0, totalDiscountGiven: 0, potentialRegistrationValue: 0 })
  })

  it('total discount given sums the stored snapshot amounts, not recalculated values', () => {
    // discountAmount/finalFee here deliberately don't correspond to any
    // real discount formula — proving the sum uses exactly what's stored,
    // never recomputing from a discount type/value.
    const totals = summarisePromoCodeUsage([
      { status: 'CONFIRMED', discountAmount: 123.45, finalFee: 876.55 },
      { status: 'CONFIRMED', discountAmount: 67.89, finalFee: 32.11 },
    ])
    expect(totals.totalDiscountGiven).toBe(191.34)
    expect(totals.potentialRegistrationValue).toBe(908.66)
  })

  it('treats a null discountAmount/finalFee as zero rather than throwing', () => {
    const totals = summarisePromoCodeUsage([{ status: 'CONFIRMED', discountAmount: null, finalFee: null }])
    expect(totals).toEqual({ totalUses: 1, totalDiscountGiven: 0, potentialRegistrationValue: 0 })
  })

  it('returns all zeros for an empty list', () => {
    expect(summarisePromoCodeUsage([])).toEqual({ totalUses: 0, totalDiscountGiven: 0, potentialRegistrationValue: 0 })
  })
})

describe('isBetterPromoCodeRanking', () => {
  const a = { id: 'a', code: 'ALPHA', createdAt: new Date('2026-01-01T00:00:00.000Z') }
  const b = { id: 'b', code: 'BETA', createdAt: new Date('2026-02-01T00:00:00.000Z') }

  it('a strictly higher value wins, most used and highest value resolve correctly', () => {
    expect(isBetterPromoCodeRanking(10, b, 5, a)).toBe(true)
    expect(isBetterPromoCodeRanking(5, b, 10, a)).toBe(false)
  })

  it('on a tied value, the code created earlier wins', () => {
    // b was created after a, so a (already current) should not be replaced by b.
    expect(isBetterPromoCodeRanking(5, b, 5, a)).toBe(false)
    // a was created before b, so a should replace b as the winner.
    expect(isBetterPromoCodeRanking(5, a, 5, b)).toBe(true)
  })

  it('on a tie of both value and createdAt, the alphabetically earlier code wins', () => {
    const sameInstant = new Date('2026-01-01T00:00:00.000Z')
    const alpha = { id: 'a', code: 'ALPHA', createdAt: sameInstant }
    const beta = { id: 'b', code: 'BETA', createdAt: sameInstant }
    expect(isBetterPromoCodeRanking(5, alpha, 5, beta)).toBe(true)
    expect(isBetterPromoCodeRanking(5, beta, 5, alpha)).toBe(false)
  })
})

describe('remainingPromoCodeUses', () => {
  it('returns null (dash in the UI) when maxTotalUses is unlimited', () => {
    expect(remainingPromoCodeUses(null, 5)).toBeNull()
  })

  it('subtracts total uses from the limit', () => {
    expect(remainingPromoCodeUses(10, 4)).toBe(6)
  })

  it('never goes below zero even if usage exceeds a since-lowered limit', () => {
    expect(remainingPromoCodeUses(5, 8)).toBe(0)
  })
})
