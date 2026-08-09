import { describe, expect, it } from 'vitest'

import { promoCodeFormSchema } from './promo-code-schema'

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    code: 'EDU20',
    description: 'Test promo code',
    discountType: 'PERCENTAGE',
    discountValue: '20',
    appliesToAllCourses: true,
    courseIds: [],
    startsAt: '',
    expiresAt: '',
    maxTotalUses: '',
    maxUsesPerTeacher: '1',
    isPaused: false,
    ...overrides,
  }
}

describe('promoCodeFormSchema — code normalisation', () => {
  it('stores the code uppercase and trimmed regardless of how it was typed', () => {
    for (const input of ['edu20', 'Edu20', 'EDU20', '  edu20  ']) {
      const result = promoCodeFormSchema.safeParse(baseInput({ code: input }))
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.code).toBe('EDU20')
    }
  })

  it('rejects a code containing whitespace', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ code: 'EDU 20' }))
    expect(result.success).toBe(false)
  })

  it('rejects a code containing characters outside A-Z and 0-9', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ code: 'EDU-20' }))
    expect(result.success).toBe(false)
  })
})

describe('promoCodeFormSchema — discount rules', () => {
  it('rejects a percentage above 100', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ discountType: 'PERCENTAGE', discountValue: '150' }))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((i) => i.path.join('.') === 'discountValue')).toBe(true)
  })

  it('rejects a percentage of zero', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ discountType: 'PERCENTAGE', discountValue: '0' }))
    expect(result.success).toBe(false)
  })

  it('rejects a negative percentage', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ discountType: 'PERCENTAGE', discountValue: '-5' }))
    expect(result.success).toBe(false)
  })

  it('accepts a percentage of exactly 1 and exactly 100', () => {
    expect(promoCodeFormSchema.safeParse(baseInput({ discountType: 'PERCENTAGE', discountValue: '1' })).success).toBe(true)
    expect(promoCodeFormSchema.safeParse(baseInput({ discountType: 'PERCENTAGE', discountValue: '100' })).success).toBe(true)
  })

  it('rejects a fixed amount without a currency', () => {
    const result = promoCodeFormSchema.safeParse(
      baseInput({ discountType: 'FIXED_AMOUNT', discountValue: '50', currency: '' }),
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((i) => i.path.join('.') === 'currency')).toBe(true)
  })

  it('accepts a fixed amount with a currency', () => {
    const result = promoCodeFormSchema.safeParse(
      baseInput({ discountType: 'FIXED_AMOUNT', discountValue: '50', currency: 'EGP' }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a discount value of zero regardless of type', () => {
    expect(promoCodeFormSchema.safeParse(baseInput({ discountType: 'FIXED_AMOUNT', discountValue: '0', currency: 'EGP' })).success).toBe(
      false,
    )
  })
})

describe('promoCodeFormSchema — dates', () => {
  it('rejects an expiry date before the start date', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ startsAt: '2026-08-15', expiresAt: '2026-08-01' }))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((i) => i.path.join('.') === 'expiresAt')).toBe(true)
  })

  it('accepts an expiry date on the same calendar day as the start date (end of day is after start of day)', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ startsAt: '2026-08-15', expiresAt: '2026-08-15' }))
    expect(result.success).toBe(true)
  })

  it('accepts blank start and expiry dates — valid immediately and indefinitely', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ startsAt: '', expiresAt: '' }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.startsAt).toBeNull()
      expect(result.data.expiresAt).toBeNull()
    }
  })
})

describe('promoCodeFormSchema — applies to courses', () => {
  it('rejects neither all courses nor any selected course', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ appliesToAllCourses: false, courseIds: [] }))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((i) => i.path.join('.') === 'courseIds')).toBe(true)
  })

  it('accepts all courses with no individual selection', () => {
    expect(promoCodeFormSchema.safeParse(baseInput({ appliesToAllCourses: true, courseIds: [] })).success).toBe(true)
  })

  it('accepts specific courses selected with appliesToAllCourses false', () => {
    expect(
      promoCodeFormSchema.safeParse(baseInput({ appliesToAllCourses: false, courseIds: ['course-1'] })).success,
    ).toBe(true)
  })
})

describe('promoCodeFormSchema — blank optional fields', () => {
  it('blank maximum total uses normalises to null (unlimited)', () => {
    const result = promoCodeFormSchema.safeParse(baseInput({ maxTotalUses: '' }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.maxTotalUses).toBeNull()
  })

  it('rejects a maximum total uses below 1', () => {
    expect(promoCodeFormSchema.safeParse(baseInput({ maxTotalUses: '0' })).success).toBe(false)
  })

  it('defaults maximum uses per teacher to 1', () => {
    const input: Record<string, unknown> = baseInput()
    input.maxUsesPerTeacher = undefined
    const result = promoCodeFormSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.maxUsesPerTeacher).toBe(1)
  })

  it('rejects maximum uses per teacher below 1', () => {
    expect(promoCodeFormSchema.safeParse(baseInput({ maxUsesPerTeacher: '0' })).success).toBe(false)
  })
})
