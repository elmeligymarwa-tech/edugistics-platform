import { z } from 'zod'

import { isValidPromoCodeFormat, normalisePromoCode, PromoCodeDiscountType, PromoCodeTeacherLimitScope } from './promo-code'
import { cairoDateTimeLocalToUtc } from './timezone'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * A plain "YYYY-MM-DD" form value, resolved to the start or end of that
 * calendar day in Africa/Cairo — this is where the domain's "use
 * Africa/Cairo for all date comparisons" rule actually gets implemented;
 * derivePromoCodeStatus itself just compares the resulting instants. Blank
 * strings, undefined and null all normalise to null: no start date means
 * valid immediately, no expiry date means valid indefinitely.
 */
function optionalCairoBoundaryDate(boundary: 'start' | 'end') {
  const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999'
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z
      .string()
      .regex(DATE_ONLY_PATTERN, 'Enter a valid date.')
      .nullable()
      .optional()
      .transform((value) => (value ? cairoDateTimeLocalToUtc(`${value}T${time}`) : null)),
  )
}

/** Blank strings, undefined and null all normalise to null — an empty maximum-uses field means unlimited, not zero. */
function optionalPositiveInt(message: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.coerce.number().int().positive(message).nullable().optional().transform((value) => value ?? null),
  )
}

const promoCodeBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required.')
    .transform(normalisePromoCode)
    .refine(isValidPromoCodeFormat, 'Use only letters A-Z and numbers 0-9, with no spaces.'),
  description: z.string().trim().min(1, 'Description is required.'),
  discountType: PromoCodeDiscountType,
  discountValue: z.coerce.number().positive('Discount value must be greater than zero.'),
  // Only meaningful for FIXED_AMOUNT — see the superRefine rule below. Not user-editable in Phase A; the form's type selector shows "%" or the currency itself.
  currency: z.string().trim().optional(),
  appliesToAllCourses: z.boolean().default(false),
  courseIds: z.array(z.string()).default([]),
  startsAt: optionalCairoBoundaryDate('start'),
  expiresAt: optionalCairoBoundaryDate('end'),
  maxTotalUses: optionalPositiveInt('Maximum total uses must be at least 1.'),
  maxUsesPerTeacher: z.coerce.number().int().min(1, 'Must be at least 1.').default(1),
  maxUsesPerTeacherScope: PromoCodeTeacherLimitScope.default('ALL_COURSES'),
  isPaused: z.boolean().default(false),
})

/**
 * The single server-side validation authority for a promo code, per spec:
 * every cross-field rule (percentage bounds, fixed-amount currency, expiry
 * after start, applies-to-courses) lives here, not scattered across the
 * form and the action. Uniqueness of `code` among non-archived rows is the
 * one rule this schema cannot express (it needs a database lookup) — that
 * check happens in the server action, immediately after this schema
 * validates everything else.
 */
export const promoCodeFormSchema = promoCodeBaseSchema.superRefine((data, ctx) => {
  if (data.discountType === 'PERCENTAGE' && (data.discountValue < 1 || data.discountValue > 100)) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Percentage discount must be between 1 and 100.' })
  }

  if (data.discountType === 'FIXED_AMOUNT' && !data.currency?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Currency is required for a fixed amount discount.' })
  }

  if (data.startsAt && data.expiresAt && data.expiresAt <= data.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Expiry date must be after the start date.' })
  }

  if (!data.appliesToAllCourses && data.courseIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['courseIds'], message: 'Select at least one course, or choose All Courses.' })
  }
})

export type PromoCodeFormValues = z.infer<typeof promoCodeFormSchema>

/** The public "apply a promo code" request — deliberately just a code and a course id. The browser never sends a fee, a discount or a final figure; the server looks all of that up itself. */
export const promoCodeValidationRequestSchema = z.object({
  code: z.string().trim().min(1, 'Enter a promo code.'),
  courseId: z.string().trim().min(1, 'Please select a course.'),
})

export type PromoCodeValidationRequest = z.infer<typeof promoCodeValidationRequestSchema>
