import 'server-only'

import type { Prisma, RegistrationStatus } from '@prisma/client'

import {
  derivePromoCodeStatus,
  isBetterPromoCodeRanking,
  PROMO_CODE_PAGE_SIZE,
  PROMO_CODE_STATUSES,
  remainingPromoCodeUses,
  roundToTwoDecimals,
  summarisePromoCodeUsage,
  type PromoCodeDiscountType,
  type PromoCodeStatus,
  type PromoCodeTeacherLimitScope,
} from '@/domain/training/promo-code'
import { prisma } from './prisma'

export { PROMO_CODE_PAGE_SIZE }

export type PromoCodeSortField = 'createdAt' | 'expiresAt' | 'usage'
export type SortDirection = 'asc' | 'desc'

export interface PromoCodeFilters {
  search?: string
  status?: PromoCodeStatus
}

const STATUS_VALUES = new Set<string>(PROMO_CODE_STATUSES)
const SORT_FIELD_VALUES = new Set<string>(['createdAt', 'expiresAt', 'usage'])

/** Shared by the list page and any future link into it, so a filtered/sorted URL always means the same thing. */
export function parsePromoCodeSearchParams(params: Record<string, string | undefined>): {
  filters: PromoCodeFilters
  sortField: PromoCodeSortField
  sortDir: SortDirection
} {
  const filters: PromoCodeFilters = {}
  if (params.q?.trim()) filters.search = params.q.trim()
  if (params.status && STATUS_VALUES.has(params.status)) filters.status = params.status as PromoCodeStatus

  const sortField = params.sortField && SORT_FIELD_VALUES.has(params.sortField) ? (params.sortField as PromoCodeSortField) : 'createdAt'
  const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc'

  return { filters, sortField, sortDir }
}

export interface PromoCodeListItem {
  id: string
  code: string
  description: string
  discountType: PromoCodeDiscountType
  discountValue: number
  currency: string
  appliesToAllCourses: boolean
  /** "All Courses", a single course's name, or "N courses" — ready for direct display. */
  appliesToLabel: string
  /** The underlying course ids, regardless of appliesToLabel's display form — the edit dialog reuses this list rather than re-fetching. */
  courseIds: string[]
  startsAt: Date | null
  expiresAt: Date | null
  maxTotalUses: number | null
  maxUsesPerTeacher: number
  maxUsesPerTeacherScope: PromoCodeTeacherLimitScope
  isPaused: boolean
  archivedAt: Date | null
  createdAt: Date
  status: PromoCodeStatus
  /** Count of CONFIRMED registrations only — see summarisePromoCodeUsage. */
  useCount: number
  /** maxTotalUses - useCount, clamped at zero; null when maxTotalUses is unlimited (dash in the UI). */
  remainingUses: number | null
  /** Sum of discountAmount across CONFIRMED registrations, from each registration's own stored snapshot — never recalculated from the code's current discountValue. */
  totalDiscountGiven: number
  /** Sum of finalFee across CONFIRMED registrations — "Potential Registration Value", never "revenue": payment isn't collected through this system. */
  potentialRegistrationValue: number
  /** True only for a FIXED_AMOUNT code whose currency doesn't match at least one course it's eligible for — computed live from the code's linked courses (or, for an all-courses code, every active course), never stored. Registration validation already rejects the code silently in this case; this is how an administrator finds out why. */
  currencyMismatch: boolean
}

const LIST_INCLUDE = {
  courses: { include: { course: { select: { name: true, currency: true } } } },
} satisfies Prisma.PromoCodeInclude

type PromoCodeWithCourses = Prisma.PromoCodeGetPayload<{ include: typeof LIST_INCLUDE }>

function toAppliesToLabel(row: PromoCodeWithCourses): string {
  if (row.appliesToAllCourses) return 'All Courses'
  if (row.courses.length === 1) return row.courses[0]!.course.name
  return `${row.courses.length} courses`
}

function hasCurrencyMismatch(row: PromoCodeWithCourses, activeCourseCurrencies: Set<string>): boolean {
  if (row.discountType !== 'FIXED_AMOUNT') return false
  if (row.appliesToAllCourses) {
    return [...activeCourseCurrencies].some((currency) => currency !== row.currency)
  }
  return row.courses.some((entry) => entry.course.currency !== row.currency)
}

/**
 * The single authoritative usage-totals query — every figure here is a SQL
 * expression of the exact rule summarisePromoCodeUsage documents in pure
 * JS: only CONFIRMED registrations count, and every amount is summed from
 * that registration's own stored snapshot (discountAmount, finalFee), never
 * recalculated from the promo code's current settings. Used by the admin
 * list, the dashboard summary and the Excel export — anywhere totals are
 * needed for many codes at once, where fetching every registration row (as
 * the single-code detail view does) would be wasteful.
 */
export interface PromoCodeUsageAggregate {
  totalUses: number
  totalDiscountGiven: number
  potentialRegistrationValue: number
}

export async function getPromoCodeUsageAggregates(promoCodeIds: string[]): Promise<Map<string, PromoCodeUsageAggregate>> {
  if (promoCodeIds.length === 0) return new Map()

  const rows = await prisma.registration.groupBy({
    by: ['promoCodeId'],
    where: { promoCodeId: { in: promoCodeIds }, status: 'CONFIRMED' },
    _count: { _all: true },
    _sum: { discountAmount: true, finalFee: true },
  })

  const map = new Map<string, PromoCodeUsageAggregate>()
  for (const row of rows) {
    if (!row.promoCodeId) continue
    map.set(row.promoCodeId, {
      totalUses: row._count._all,
      totalDiscountGiven: Number(row._sum.discountAmount ?? 0),
      potentialRegistrationValue: Number(row._sum.finalFee ?? 0),
    })
  }
  return map
}

const EMPTY_AGGREGATE: PromoCodeUsageAggregate = { totalUses: 0, totalDiscountGiven: 0, potentialRegistrationValue: 0 }

function toListItem(
  row: PromoCodeWithCourses,
  now: Date,
  aggregate: PromoCodeUsageAggregate,
  activeCourseCurrencies: Set<string>,
): PromoCodeListItem {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    currency: row.currency,
    appliesToAllCourses: row.appliesToAllCourses,
    appliesToLabel: toAppliesToLabel(row),
    courseIds: row.courses.map((c) => c.courseId),
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    maxTotalUses: row.maxTotalUses,
    maxUsesPerTeacher: row.maxUsesPerTeacher,
    maxUsesPerTeacherScope: row.maxUsesPerTeacherScope,
    isPaused: row.isPaused,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    status: derivePromoCodeStatus(
      {
        archivedAt: row.archivedAt,
        isPaused: row.isPaused,
        startsAt: row.startsAt,
        expiresAt: row.expiresAt,
        maxTotalUses: row.maxTotalUses,
        currentUseCount: aggregate.totalUses,
      },
      now,
    ),
    useCount: aggregate.totalUses,
    remainingUses: remainingPromoCodeUses(row.maxTotalUses, aggregate.totalUses),
    totalDiscountGiven: aggregate.totalDiscountGiven,
    potentialRegistrationValue: aggregate.potentialRegistrationValue,
    currencyMismatch: hasCurrencyMismatch(row, activeCourseCurrencies),
  }
}

function buildSearchWhere(search: string | undefined): Prisma.PromoCodeWhereInput {
  const trimmed = search?.trim()
  if (!trimmed) return {}
  return {
    OR: [
      { code: { contains: trimmed, mode: 'insensitive' } },
      { description: { contains: trimmed, mode: 'insensitive' } },
    ],
  }
}

/**
 * Translates the same precedence rules as derivePromoCodeStatus into a
 * Prisma where-clause, so the list can filter by status server side without
 * loading every row into memory to compute it in JS. EXHAUSTED can't be
 * expressed as a plain column comparison — it depends on a live count of
 * CONFIRMED registrations against maxTotalUses — so its ids are precomputed
 * with a raw query (see exhaustedPromoCodeIds) and passed in here. ACTIVE
 * excludes those same ids for the same reason: a date/pause-active code
 * that has also become exhausted is EXHAUSTED, not ACTIVE, per
 * derivePromoCodeStatus's precedence.
 */
function buildStatusWhere(status: PromoCodeStatus | undefined, now: Date, exhaustedIds: string[]): Prisma.PromoCodeWhereInput {
  if (!status) return {}
  switch (status) {
    case 'ARCHIVED':
      return { archivedAt: { not: null } }
    case 'PAUSED':
      return { archivedAt: null, isPaused: true }
    case 'SCHEDULED':
      return { archivedAt: null, isPaused: false, startsAt: { gt: now } }
    case 'EXPIRED':
      return {
        archivedAt: null,
        isPaused: false,
        expiresAt: { lt: now },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      }
    case 'EXHAUSTED':
      return { id: { in: exhaustedIds } }
    case 'ACTIVE':
      return {
        archivedAt: null,
        isPaused: false,
        id: { notIn: exhaustedIds },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
      }
  }
}

/** Ids of every non-archived, non-paused, currently-started, unexpired promo code whose CONFIRMED use count has reached its maxTotalUses — i.e. exactly the rows derivePromoCodeStatus would call EXHAUSTED. Only run when the EXHAUSTED filter is actually selected. */
async function exhaustedPromoCodeIds(now: Date): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT pc.id FROM "PromoCode" pc
    WHERE pc."archivedAt" IS NULL
      AND pc."isPaused" = false
      AND (pc."startsAt" IS NULL OR pc."startsAt" <= ${now})
      AND (pc."expiresAt" IS NULL OR pc."expiresAt" >= ${now})
      AND pc."maxTotalUses" IS NOT NULL
      AND (SELECT COUNT(*) FROM "Registration" r WHERE r."promoCodeId" = pc.id AND r.status = 'CONFIRMED') >= pc."maxTotalUses"
  `
  return rows.map((row) => row.id)
}

function buildOrderBy(sortField: PromoCodeSortField, sortDir: SortDirection): Prisma.PromoCodeOrderByWithRelationInput {
  if (sortField === 'expiresAt') return { expiresAt: sortDir }
  // 'usage': Prisma can't order by a derived, counted relation without a raw
  // query — createdAt gives a stable, well-defined fallback order instead.
  if (sortField === 'usage') return { createdAt: sortDir }
  return { createdAt: sortDir }
}

/** Page of promo codes for the admin list — never fetches more than one page's worth of rows. */
export async function listPromoCodesForAdmin(
  filters: PromoCodeFilters,
  page: number,
  sortField: PromoCodeSortField = 'createdAt',
  sortDir: SortDirection = 'desc',
): Promise<{ rows: PromoCodeListItem[]; totalCount: number }> {
  const now = new Date()
  const needsExhaustedIds = filters.status === 'EXHAUSTED' || filters.status === 'ACTIVE'
  const exhaustedIds = needsExhaustedIds ? await exhaustedPromoCodeIds(now) : []
  const where: Prisma.PromoCodeWhereInput = {
    AND: [buildSearchWhere(filters.search), buildStatusWhere(filters.status, now, exhaustedIds)],
  }

  const [rows, totalCount, activeCourses] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: buildOrderBy(sortField, sortDir),
      skip: page * PROMO_CODE_PAGE_SIZE,
      take: PROMO_CODE_PAGE_SIZE,
    }),
    prisma.promoCode.count({ where }),
    prisma.course.findMany({ where: { isActive: true, archivedAt: null }, select: { currency: true }, distinct: ['currency'] }),
  ])

  const aggregates = await getPromoCodeUsageAggregates(rows.map((row) => row.id))
  const activeCourseCurrencies = new Set(activeCourses.map((course) => course.currency))

  return {
    rows: rows.map((row) => toListItem(row, now, aggregates.get(row.id) ?? EMPTY_AGGREGATE, activeCourseCurrencies)),
    totalCount,
  }
}

/** True when `normalisedCode` is free to use — no non-archived promo code already has it. Pass excludeId when checking during an edit so a code doesn't conflict with itself. */
export async function isPromoCodeAvailable(normalisedCode: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.promoCode.findFirst({
    where: { code: normalisedCode, archivedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  })
  return !existing
}

export const PROMO_CODE_STATUS_FILTER_OPTIONS = PROMO_CODE_STATUSES

// ---------------------------------------------------------------------------
// Dashboard summary (Phase C) — one query pass over every promo code, since
// this is an admin-only, whole-dataset view (not paginated) and the number
// of promo codes a school ever creates is small. "Active" here means the
// same thing derivePromoCodeStatus means by ACTIVE, including the exhausted
// exclusion buildStatusWhere's ACTIVE branch applies. Never call this
// "revenue" anywhere it's displayed — payment is not collected through this
// system.
// ---------------------------------------------------------------------------

export interface PromoCodeDashboardSummary {
  activeCodes: number
  totalUses: number
  totalDiscountGiven: number
  mostUsedCode: { id: string; code: string; uses: number } | null
  highestValueCode: { id: string; code: string; potentialRegistrationValue: number } | null
}

export async function getPromoCodeDashboardSummary(): Promise<PromoCodeDashboardSummary> {
  const now = new Date()

  const [exhaustedIds, usageByCode, allCodes] = await Promise.all([
    exhaustedPromoCodeIds(now),
    prisma.registration.groupBy({
      by: ['promoCodeId'],
      where: { promoCodeId: { not: null }, status: 'CONFIRMED' },
      _count: { _all: true },
      _sum: { discountAmount: true, finalFee: true },
    }),
    prisma.promoCode.findMany({ select: { id: true, code: true, createdAt: true } }),
  ])

  const activeCodes = await prisma.promoCode.count({ where: buildStatusWhere('ACTIVE', now, exhaustedIds) })

  const codeById = new Map(allCodes.map((entry) => [entry.id, entry]))

  let totalUses = 0
  let totalDiscountGiven = 0
  // Ties resolved by isBetterPromoCodeRanking — see its doc comment.
  let mostUsed: { id: string; code: string; uses: number; createdAt: Date } | null = null
  let highestValue: { id: string; code: string; potentialRegistrationValue: number; createdAt: Date } | null = null

  for (const row of usageByCode) {
    if (!row.promoCodeId) continue
    const info = codeById.get(row.promoCodeId)
    if (!info) continue

    const uses = row._count._all
    const discountGiven = Number(row._sum.discountAmount ?? 0)
    const potentialValue = Number(row._sum.finalFee ?? 0)

    totalUses += uses
    totalDiscountGiven += discountGiven

    if (!mostUsed || isBetterPromoCodeRanking(uses, info, mostUsed.uses, mostUsed)) {
      mostUsed = { id: info.id, code: info.code, uses, createdAt: info.createdAt }
    }

    if (!highestValue || isBetterPromoCodeRanking(potentialValue, info, highestValue.potentialRegistrationValue, highestValue)) {
      highestValue = { id: info.id, code: info.code, potentialRegistrationValue: potentialValue, createdAt: info.createdAt }
    }
  }

  return {
    activeCodes,
    totalUses,
    totalDiscountGiven: roundToTwoDecimals(totalDiscountGiven),
    mostUsedCode: mostUsed ? { id: mostUsed.id, code: mostUsed.code, uses: mostUsed.uses } : null,
    highestValueCode: highestValue
      ? { id: highestValue.id, code: highestValue.code, potentialRegistrationValue: roundToTwoDecimals(highestValue.potentialRegistrationValue) }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Single-code detail view (Phase C)
// ---------------------------------------------------------------------------

export interface PromoCodeUsageDetailItem {
  registrationId: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  registeredAt: Date
  originalFee: number
  discountAmount: number
  finalFee: number
  status: RegistrationStatus
}

export interface PromoCodeDetail {
  id: string
  code: string
  description: string
  discountType: PromoCodeDiscountType
  discountValue: number
  currency: string
  appliesToLabel: string
  status: PromoCodeStatus
  maxTotalUses: number | null
  maxUsesPerTeacher: number
  maxUsesPerTeacherScope: PromoCodeTeacherLimitScope
  totalUses: number
  remainingUses: number | null
  totalDiscountGiven: number
  potentialRegistrationValue: number
  /** Every registration that ever used this code, including CANCELLED — each row carries its own status so the admin can tell CONFIRMED/WAITLISTED/CANCELLED apart. CANCELLED rows are excluded from every total above (per summarisePromoCodeUsage) but never hidden from this list — an admin needs to see what was discounted historically even after the place was released. */
  registrations: PromoCodeUsageDetailItem[]
}

export async function getPromoCodeDetail(id: string): Promise<PromoCodeDetail | null> {
  const now = new Date()
  const promoCode = await prisma.promoCode.findUnique({
    where: { id },
    include: LIST_INCLUDE,
  })
  if (!promoCode) return null

  const registrations = await prisma.registration.findMany({
    where: { promoCodeId: id },
    include: { teacher: { select: { fullName: true, emailOriginal: true } }, course: { select: { name: true } } },
    orderBy: { registeredAt: 'desc' },
  })

  const totals = summarisePromoCodeUsage(
    registrations.map((r) => ({ status: r.status, discountAmount: r.discountAmount != null ? Number(r.discountAmount) : null, finalFee: r.finalFee != null ? Number(r.finalFee) : null })),
  )

  return {
    id: promoCode.id,
    code: promoCode.code,
    description: promoCode.description,
    discountType: promoCode.discountType,
    discountValue: Number(promoCode.discountValue),
    currency: promoCode.currency,
    appliesToLabel: toAppliesToLabel(promoCode),
    status: derivePromoCodeStatus(
      {
        archivedAt: promoCode.archivedAt,
        isPaused: promoCode.isPaused,
        startsAt: promoCode.startsAt,
        expiresAt: promoCode.expiresAt,
        maxTotalUses: promoCode.maxTotalUses,
        currentUseCount: totals.totalUses,
      },
      now,
    ),
    maxTotalUses: promoCode.maxTotalUses,
    maxUsesPerTeacher: promoCode.maxUsesPerTeacher,
    maxUsesPerTeacherScope: promoCode.maxUsesPerTeacherScope,
    totalUses: totals.totalUses,
    remainingUses: remainingPromoCodeUses(promoCode.maxTotalUses, totals.totalUses),
    totalDiscountGiven: totals.totalDiscountGiven,
    potentialRegistrationValue: totals.potentialRegistrationValue,
    registrations: registrations.map((r) => ({
      registrationId: r.id,
      teacherFullName: r.teacher.fullName,
      teacherEmail: r.teacher.emailOriginal,
      courseName: r.course.name,
      registeredAt: r.registeredAt,
      originalFee: r.originalFee != null ? Number(r.originalFee) : 0,
      discountAmount: r.discountAmount != null ? Number(r.discountAmount) : 0,
      finalFee: r.finalFee != null ? Number(r.finalFee) : 0,
      status: r.status,
    })),
  }
}

// ---------------------------------------------------------------------------
// Excel export (Phase C) — every non-archived-or-not promo code with its
// totals, unpaginated. Mirrors listPromoCodesForAdmin's shape but without
// filters/paging, since the export sheet is a full snapshot.
// ---------------------------------------------------------------------------

export async function listAllPromoCodesForExport(): Promise<PromoCodeListItem[]> {
  const now = new Date()
  const [rows, activeCourses] = await Promise.all([
    prisma.promoCode.findMany({ include: LIST_INCLUDE, orderBy: { createdAt: 'desc' } }),
    prisma.course.findMany({ where: { isActive: true, archivedAt: null }, select: { currency: true }, distinct: ['currency'] }),
  ])

  const aggregates = await getPromoCodeUsageAggregates(rows.map((row) => row.id))
  const activeCourseCurrencies = new Set(activeCourses.map((course) => course.currency))

  return rows.map((row) => toListItem(row, now, aggregates.get(row.id) ?? EMPTY_AGGREGATE, activeCourseCurrencies))
}
