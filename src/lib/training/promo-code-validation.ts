import 'server-only'

import type { Prisma } from '@prisma/client'

import {
  applyPromoDiscount,
  derivePromoCodeStatus,
  normalisePromoCode,
  PROMO_CODE_COURSE_INELIGIBLE_MESSAGE,
  PROMO_CODE_INVALID_MESSAGE,
  promoCodeStatusRejectionMessage,
  type PromoCodeDiscountType,
  type PromoCodeTeacherLimitScope,
} from '@/domain/training/promo-code'
import { prisma } from './prisma'

type PromoCodeDbClient = typeof prisma | Prisma.TransactionClient

export interface ValidatedPromoCode {
  id: string
  code: string
  discountType: PromoCodeDiscountType
  discountValue: number
  currency: string
  maxUsesPerTeacher: number
  maxUsesPerTeacherScope: PromoCodeTeacherLimitScope
}

export type PromoCodeValidationResult =
  | {
      ok: true
      promoCode: ValidatedPromoCode
      originalFee: number
      discountAmount: number
      finalFee: number
    }
  | { ok: false; message: string }

export interface ValidatePromoCodeParams {
  /** `prisma` for the apply-time validation endpoint, or the active `tx` when re-validating inside the submission/promotion transaction. */
  db: PromoCodeDbClient
  code: string
  course: { id: string; feeAmount: Prisma.Decimal | number; currency: string }
  now?: Date
  /**
   * Locks the PromoCode row (`SELECT ... FOR UPDATE`) before counting uses,
   * so two simultaneous submissions racing for the final use serialise on
   * this row rather than both reading the same pre-lock count. Only ever
   * true inside the submission/promotion transaction — the apply-time
   * endpoint runs outside any transaction and has nothing to lock against,
   * which is exactly why submission never trusts the apply-time result and
   * always re-validates with lockRow: true.
   */
  lockRow?: boolean
}

/**
 * The single authoritative promo code validation — steps 1-9 of the Phase B
 * spec, in order. Used unlocked by the public apply endpoint and locked
 * inside the registration submission transaction, so the two can never
 * calculate a different discount for the same code and course.
 *
 * The per-teacher limit (step 2 of SUBMISSION) is deliberately NOT checked
 * here: at apply time no email has been entered yet, so there is nothing to
 * check against. That check only ever happens at submission, against the
 * teacher's normalised email — see registerForCourse.
 */
export async function validatePromoCodeForCourse(params: ValidatePromoCodeParams): Promise<PromoCodeValidationResult> {
  const { db, code, course, now = new Date(), lockRow = false } = params
  const normalisedCode = normalisePromoCode(code)

  if (lockRow) {
    const locked = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "PromoCode" WHERE code = ${normalisedCode} AND "archivedAt" IS NULL FOR UPDATE`
    if (locked.length === 0) return { ok: false, message: PROMO_CODE_INVALID_MESSAGE }
  }

  const promoCode = await db.promoCode.findFirst({
    where: { code: normalisedCode, archivedAt: null },
    include: { courses: { select: { courseId: true } } },
  })
  if (!promoCode) return { ok: false, message: PROMO_CODE_INVALID_MESSAGE }

  const currentUseCount = await db.registration.count({ where: { promoCodeId: promoCode.id, status: 'CONFIRMED' } })
  const status = derivePromoCodeStatus(
    {
      archivedAt: promoCode.archivedAt,
      isPaused: promoCode.isPaused,
      startsAt: promoCode.startsAt,
      expiresAt: promoCode.expiresAt,
      maxTotalUses: promoCode.maxTotalUses,
      currentUseCount,
    },
    now,
  )
  if (status !== 'ACTIVE') {
    return { ok: false, message: promoCodeStatusRejectionMessage(status) }
  }

  const courseEligible = promoCode.appliesToAllCourses || promoCode.courses.some((entry) => entry.courseId === course.id)
  if (!courseEligible) {
    return { ok: false, message: PROMO_CODE_COURSE_INELIGIBLE_MESSAGE }
  }

  if (promoCode.discountType === 'FIXED_AMOUNT' && promoCode.currency !== course.currency) {
    // A currency mismatch is a configuration problem, not something the
    // teacher can act on — never surface "currency mismatch" to them.
    // Administrators see this flagged directly on the promo codes list
    // instead (PromoCodeListItem.currencyMismatch in promo-codes.ts),
    // computed live from the code's eligible courses.
    return { ok: false, message: PROMO_CODE_INVALID_MESSAGE }
  }

  const originalFee = Number(course.feeAmount)
  const discountValue = Number(promoCode.discountValue)
  const { discountAmount, finalFee } = applyPromoDiscount(originalFee, promoCode.discountType, discountValue)

  return {
    ok: true,
    promoCode: {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue,
      currency: promoCode.currency,
      maxUsesPerTeacher: promoCode.maxUsesPerTeacher,
      maxUsesPerTeacherScope: promoCode.maxUsesPerTeacherScope,
    },
    originalFee,
    discountAmount,
    finalFee,
  }
}
