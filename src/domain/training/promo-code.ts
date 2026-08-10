import { z } from 'zod'

/** Server and client both need this — the server to paginate the query, the client table to compute page ranges. Kept outside src/lib/training (marked 'server-only') so the client table component can import it directly, matching REGISTRATIONS_PAGE_SIZE's placement for the same reason. */
export const PROMO_CODE_PAGE_SIZE = 20

export const PromoCodeDiscountType = z.enum(['PERCENTAGE', 'FIXED_AMOUNT'])
export type PromoCodeDiscountType = z.infer<typeof PromoCodeDiscountType>

export const PROMO_CODE_DISCOUNT_TYPE_LABELS: Record<PromoCodeDiscountType, string> = {
  PERCENTAGE: 'Percentage',
  FIXED_AMOUNT: 'Fixed amount',
}

/**
 * Scopes maxUsesPerTeacher (Phase C). ALL_COURSES (the default, and the
 * only behaviour that existed before this phase) counts a teacher's
 * CONFIRMED uses of a code across every course. PER_COURSE counts only
 * within the specific course being registered for, so the same teacher can
 * use the code once per course rather than once ever. Every code created
 * before this phase keeps ALL_COURSES — the migration's column default —
 * so existing behaviour is unchanged with no data migration needed.
 */
export const PromoCodeTeacherLimitScope = z.enum(['ALL_COURSES', 'PER_COURSE'])
export type PromoCodeTeacherLimitScope = z.infer<typeof PromoCodeTeacherLimitScope>

export const PROMO_CODE_TEACHER_LIMIT_SCOPE_LABELS: Record<PromoCodeTeacherLimitScope, string> = {
  ALL_COURSES: 'Across all courses',
  PER_COURSE: 'Per course',
}

export const PROMO_CODE_TEACHER_LIMIT_SCOPE_HELP: Record<PromoCodeTeacherLimitScope, string> = {
  ALL_COURSES: 'A teacher can use this code once in total, no matter how many different courses they register for.',
  PER_COURSE: 'A teacher can use this code once per course — using it on one course does not stop them using it again on a different course.',
}

/** Only letters A-Z and digits 0-9 once normalised — simple enough to type on a phone and read aloud on a webinar. */
const PROMO_CODE_PATTERN = /^[A-Z0-9]+$/

/** Canonical stored form: trimmed and uppercased. EDU20, edu20 and Edu20 all normalise to the same value — this is the only place that conversion happens, so every caller (form validation, the uniqueness check, and later phases matching a code at registration time) agrees on the same string. */
export function normalisePromoCode(code: string): string {
  return code.trim().toUpperCase()
}

export function isValidPromoCodeFormat(normalisedCode: string): boolean {
  return PROMO_CODE_PATTERN.test(normalisedCode)
}

// ---------------------------------------------------------------------------
// Derived status — the single authoritative implementation. No component
// recalculates this, and later phases (validating a code at registration
// time) must call this same function rather than re-deriving the rules.
// ---------------------------------------------------------------------------

export const PROMO_CODE_STATUSES = ['ARCHIVED', 'PAUSED', 'SCHEDULED', 'EXPIRED', 'EXHAUSTED', 'ACTIVE'] as const
export type PromoCodeStatus = (typeof PROMO_CODE_STATUSES)[number]

export const PROMO_CODE_STATUS_LABELS: Record<PromoCodeStatus, string> = {
  ARCHIVED: 'Archived',
  PAUSED: 'Paused',
  SCHEDULED: 'Scheduled',
  EXPIRED: 'Expired',
  EXHAUSTED: 'Exhausted',
  ACTIVE: 'Active',
}

export interface PromoCodeStatusInput {
  archivedAt: Date | null
  isPaused: boolean
  startsAt: Date | null
  expiresAt: Date | null
  maxTotalUses: number | null
  /** Number of uses currently consumed — see countPromoCodeUses. Phase A always passes 0 (nothing can reference a promo code yet); later phases pass the live count. */
  currentUseCount: number
}

/**
 * Computed, never stored, never set manually. Precedence (first match
 * wins): ARCHIVED, PAUSED, SCHEDULED, EXPIRED, EXHAUSTED, ACTIVE.
 *
 * startsAt/expiresAt are absolute instants (Postgres timestamptz) — by the
 * time they reach this function no further timezone conversion is needed,
 * because the admin form resolves a plain "valid from/until" calendar date
 * to the start/end of that day in Africa/Cairo *before* it is stored (see
 * promo-code-schema.ts's cairo-aware date transform). That is where "uses
 * Africa/Cairo for all date comparisons" is actually implemented: a code
 * set to expire on a given calendar date remains ACTIVE through the whole
 * of that day in Cairo, not UTC.
 */
export function derivePromoCodeStatus(input: PromoCodeStatusInput, now: Date = new Date()): PromoCodeStatus {
  if (input.archivedAt) return 'ARCHIVED'
  if (input.isPaused) return 'PAUSED'
  if (input.startsAt && input.startsAt > now) return 'SCHEDULED'
  if (input.expiresAt && input.expiresAt < now) return 'EXPIRED'
  if (input.maxTotalUses != null && input.currentUseCount >= input.maxTotalUses) return 'EXHAUSTED'
  return 'ACTIVE'
}

// ---------------------------------------------------------------------------
// Usage counting — Phase A defines the rule and tests it as a pure function.
// Phase B wires it up to a live query — see validatePromoCodeForCourse in
// src/lib/training/promo-code-validation.ts, which counts uses with
// `db.registration.count({ where: { promoCodeId, status: 'CONFIRMED' } })`
// — the same rule this function encodes, so the two can never drift apart.
// ---------------------------------------------------------------------------

export type PromoCodeUsageStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'

export interface PromoCodeUsageRecord {
  status: PromoCodeUsageStatus
}

/**
 * A use is consumed only by a CONFIRMED registration. WAITLISTED never
 * consumes a use (a waitlisted teacher holds no place, so nothing has been
 * discounted yet). CANCELLED releases any use it held back to the pool —
 * counting only CONFIRMED rows achieves this automatically, since a
 * cancelled registration simply stops being counted the moment its status
 * changes, with no separate "release" step required.
 */
export function countPromoCodeUses(registrations: PromoCodeUsageRecord[]): number {
  return registrations.filter((registration) => registration.status === 'CONFIRMED').length
}

// ---------------------------------------------------------------------------
// Applies-to-courses normalisation
// ---------------------------------------------------------------------------

/** When appliesToAllCourses is true, any individually selected courses are cleared rather than stored alongside it — a promo code is never both "all courses" and "these specific courses" at once. */
export function resolveCourseIds(appliesToAllCourses: boolean, courseIds: string[]): string[] {
  return appliesToAllCourses ? [] : courseIds
}

// ---------------------------------------------------------------------------
// Discount calculation (Phase B) — the single authoritative implementation.
// Both the public validation endpoint and the registration submission
// transaction call this rather than each doing their own arithmetic, so the
// number a teacher is shown before submitting can never drift from the
// number actually written to the registration's snapshot.
// ---------------------------------------------------------------------------

export interface PromoDiscountResult {
  discountAmount: number
  finalFee: number
}

/**
 * The fee breakdown as shown to a teacher — on the public form after Apply,
 * on the confirmation screen, and in the confirmation email. Lives here
 * (not in a 'server-only' lib module) specifically so client components
 * importing it never risk pulling server-only code into the client bundle.
 */
export interface PromoBreakdown {
  code: string
  discountType: PromoCodeDiscountType
  discountValue: number
  discountLabel: string
  discountAmount: number
  originalFee: number
  finalFee: number
  currency: string
}

/** Round-half-up to two decimal places — the one rounding rule used everywhere a discount or fee is computed, so a percentage split never produces a fee with more than two decimal places. */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * PERCENTAGE: discountValue% of courseFee. FIXED_AMOUNT: discountValue
 * itself, in the promo code's currency. Either way the discount is clamped
 * so it can never exceed courseFee — finalFee can reach exactly zero but
 * never go negative.
 */
export function applyPromoDiscount(
  courseFee: number,
  discountType: PromoCodeDiscountType,
  discountValue: number,
): PromoDiscountResult {
  const rawDiscount = discountType === 'PERCENTAGE' ? (courseFee * discountValue) / 100 : discountValue
  const discountAmount = roundToTwoDecimals(Math.min(Math.max(rawDiscount, 0), courseFee))
  const finalFee = roundToTwoDecimals(courseFee - discountAmount)
  return { discountAmount, finalFee }
}

/** "20%" or "EGP 50" — the one place this label is built, reused by the admin table, the public form and transactional emails. */
export function formatPromoDiscountLabel(discountType: PromoCodeDiscountType, discountValue: number, currency: string): string {
  return discountType === 'PERCENTAGE' ? `${discountValue}%` : `${currency} ${discountValue}`
}

// ---------------------------------------------------------------------------
// Validation rejection messages (Phase B) — exact, fixed wording. Never more
// revealing than this: no message here discloses a discount value, a
// remaining-use count, or the existence of a code the teacher isn't
// eligible for. Shared between the apply-time validation endpoint and the
// submission transaction's re-validation so the two can never disagree on
// wording.
// ---------------------------------------------------------------------------

export const PROMO_CODE_INVALID_MESSAGE = 'Invalid promo code.'
export const PROMO_CODE_COURSE_INELIGIBLE_MESSAGE = 'This promo code is not available for this course.'

/** ACTIVE has nothing to reject — callers only reach this once status !== 'ACTIVE'. ARCHIVED is defensive only: every lookup already filters archivedAt: null, so an archived code is found as "no such code" long before its status would need deriving. */
export function promoCodeStatusRejectionMessage(status: Exclude<PromoCodeStatus, 'ACTIVE'>): string {
  switch (status) {
    case 'ARCHIVED':
      return PROMO_CODE_INVALID_MESSAGE
    case 'PAUSED':
      return 'This promo code is no longer available.'
    case 'SCHEDULED':
      return 'This promo code is not yet available.'
    case 'EXPIRED':
      return 'This promo code has expired.'
    case 'EXHAUSTED':
      return 'This promo code has reached its usage limit.'
  }
}

// ---------------------------------------------------------------------------
// Usage analytics (Phase C) — the single authoritative rule for every
// totals figure shown on the promo codes list, the dashboard summary, a
// code's detail view and the Excel export. Only CONFIRMED registrations
// count towards totals — WAITLISTED holds no place yet, and CANCELLED
// released its use back to the pool (see countPromoCodeUses above; this is
// the same rule, extended to sum discountAmount/finalFee alongside the
// count). Every figure is summed from the registration's own stored
// snapshot (discountAmount, finalFee) — never recalculated from the promo
// code's current settings — so editing or archiving a code afterwards can
// never change a historical total.
//
// This function operates on an already-fetched list, for the single-code
// detail view where every registration is fetched anyway for display. The
// admin list, dashboard summary and export instead run the equivalent
// aggregation as SQL (`prisma.registration.groupBy`/`aggregate` filtered to
// `status: 'CONFIRMED'`) for efficiency across many codes at once — see
// getPromoCodeUsageAggregates and getPromoCodeDashboardSummary in
// src/lib/training/promo-codes.ts. Both express the identical rule; this
// function is the rule's one written-out definition.
// ---------------------------------------------------------------------------

export interface PromoCodeUsageSummaryInput {
  status: PromoCodeUsageStatus
  discountAmount: number | null
  finalFee: number | null
}

export interface PromoCodeUsageTotals {
  totalUses: number
  totalDiscountGiven: number
  potentialRegistrationValue: number
}

export function summarisePromoCodeUsage(registrations: PromoCodeUsageSummaryInput[]): PromoCodeUsageTotals {
  const confirmed = registrations.filter((registration) => registration.status === 'CONFIRMED')
  return {
    totalUses: confirmed.length,
    totalDiscountGiven: roundToTwoDecimals(confirmed.reduce((sum, r) => sum + (r.discountAmount ?? 0), 0)),
    potentialRegistrationValue: roundToTwoDecimals(confirmed.reduce((sum, r) => sum + (r.finalFee ?? 0), 0)),
  }
}

export interface PromoCodeUsageRankingCandidate {
  id: string
  code: string
  createdAt: Date
}

/**
 * The single authoritative tie-break rule behind "most used promo code" and
 * "highest value promo code" on the dashboard summary: strictly greater
 * `candidateValue` wins; on an exact tie, the code created earlier wins (the
 * first code to reach this figure); on a full tie, the alphabetically
 * earlier code wins. Deterministic regardless of database row order, so the
 * dashboard never flips between two equally-ranked codes on a re-render.
 */
export function isBetterPromoCodeRanking(
  candidateValue: number,
  candidate: PromoCodeUsageRankingCandidate,
  currentValue: number,
  current: PromoCodeUsageRankingCandidate,
): boolean {
  if (candidateValue !== currentValue) return candidateValue > currentValue
  if (candidate.createdAt.getTime() !== current.createdAt.getTime()) return candidate.createdAt < current.createdAt
  return candidate.code < current.code
}

/** maxTotalUses null means unlimited — no dash-worthy "remaining" concept, so null propagates through rather than a sentinel number. Never goes below zero even if usage briefly exceeds the limit (e.g. an admin lowering maxTotalUses after uses were already recorded). */
export function remainingPromoCodeUses(maxTotalUses: number | null, totalUses: number): number | null {
  if (maxTotalUses == null) return null
  return Math.max(0, maxTotalUses - totalUses)
}
