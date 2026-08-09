import 'server-only'

import type { Prisma } from '@prisma/client'

import {
  countPromoCodeUses,
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
}

const LIST_INCLUDE = {
  courses: { include: { course: { select: { name: true } } } },
} satisfies Prisma.PromoCodeInclude

type PromoCodeWithCourses = Prisma.PromoCodeGetPayload<{ include: typeof LIST_INCLUDE }>

function toAppliesToLabel(row: PromoCodeWithCourses): string {
  if (row.appliesToAllCourses) return 'All Courses'
  if (row.courses.length === 1) return row.courses[0]!.course.name
  return `${row.courses.length} courses`
}

/**
 * Nothing can reference a promo code yet — Registration has no promoCodeId
 * column in Phase A, so every code's real usage is 0. Phase B, once that
 * column exists, replaces this with `prisma.registration.count({ where: {
 * promoCodeId: row.id, status: 'CONFIRMED' } })` — the exact rule
 * countPromoCodeUses documents and tests.
 */
function currentUseCount(): number {
  return countPromoCodeUses([])
}

function toListItem(row: PromoCodeWithCourses, now: Date): PromoCodeListItem {
  const useCount = currentUseCount()
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
 * loading every row into memory to compute it in JS. EXHAUSTED can never
 * match in Phase A — see currentUseCount — so it's a deliberate empty
 * result, not a bug; Phase B must revisit this once real usage exists.
 */
function buildStatusWhere(status: PromoCodeStatus | undefined, now: Date): Prisma.PromoCodeWhereInput {
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
      return { id: '' }
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

function buildOrderBy(sortField: PromoCodeSortField, sortDir: SortDirection): Prisma.PromoCodeOrderByWithRelationInput {
  if (sortField === 'expiresAt') return { expiresAt: sortDir }
  // 'usage': every code ties at 0 in Phase A (see currentUseCount) — createdAt
  // gives a stable, well-defined order until Phase B has real counts to sort by.
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
  const where: Prisma.PromoCodeWhereInput = { AND: [buildSearchWhere(filters.search), buildStatusWhere(filters.status, now)] }

  const [rows, totalCount] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: buildOrderBy(sortField, sortDir),
      skip: page * PROMO_CODE_PAGE_SIZE,
      take: PROMO_CODE_PAGE_SIZE,
    }),
    prisma.promoCode.count({ where }),
  ])

  return { rows: rows.map((row) => toListItem(row, now)), totalCount }
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
