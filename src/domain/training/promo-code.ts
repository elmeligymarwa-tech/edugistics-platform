import { z } from 'zod'

/** Server and client both need this — the server to paginate the query, the client table to compute page ranges. Kept outside src/lib/training (marked 'server-only') so the client table component can import it directly, matching REGISTRATIONS_PAGE_SIZE's placement for the same reason. */
export const PROMO_CODE_PAGE_SIZE = 20

export const PromoCodeDiscountType = z.enum(['PERCENTAGE', 'FIXED_AMOUNT'])
export type PromoCodeDiscountType = z.infer<typeof PromoCodeDiscountType>

export const PROMO_CODE_DISCOUNT_TYPE_LABELS: Record<PromoCodeDiscountType, string> = {
  PERCENTAGE: 'Percentage',
  FIXED_AMOUNT: 'Fixed amount',
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
// No registration can reference a promo code yet (no promoCodeId column
// exists on Registration in this phase), so there is nothing to wire up to
// a live query. Phase B adds that column and must count uses with
// `prisma.registration.count({ where: { promoCodeId, status: 'CONFIRMED' } })`
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
