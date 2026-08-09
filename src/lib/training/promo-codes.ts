import 'server-only'

import type { Prisma } from '@prisma/client'

import {
  derivePromoCodeStatus,
  PROMO_CODE_PAGE_SIZE,
  PROMO_CODE_STATUSES,
  type PromoCodeDiscountType,
  type PromoCodeStatus,
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
  isPaused: boolean
  archivedAt: Date | null
  createdAt: Date
  status: PromoCodeStatus
  useCount: number
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

function toListItem(row: PromoCodeWithCourses, now: Date, useCount: number, activeCourseCurrencies: Set<string>): PromoCodeListItem {
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
        currentUseCount: useCount,
      },
      now,
    ),
    useCount,
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
 * with a raw query (see exhaustedPromoCodeIds) and passed in here.
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
  const exhaustedIds = filters.status === 'EXHAUSTED' ? await exhaustedPromoCodeIds(now) : []
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

  const useCounts = await prisma.registration.groupBy({
    by: ['promoCodeId'],
    _count: { _all: true },
    where: { promoCodeId: { in: rows.map((row) => row.id) }, status: 'CONFIRMED' },
  })
  const useCountByPromoCodeId = new Map(useCounts.map((entry) => [entry.promoCodeId, entry._count._all]))
  const activeCourseCurrencies = new Set(activeCourses.map((course) => course.currency))

  return {
    rows: rows.map((row) => toListItem(row, now, useCountByPromoCodeId.get(row.id) ?? 0, activeCourseCurrencies)),
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
