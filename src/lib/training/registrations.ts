import 'server-only'

import type { EmailStatus, Prisma, RegistrationStatus } from '@prisma/client'

import { formatPromoDiscountLabel } from '@/domain/training/promo-code'
import { REGISTRATIONS_PAGE_SIZE } from '@/domain/training/schema'
import { cairoDateTimeLocalToUtc } from '@/domain/training/timezone'
import { getCampaignEmailSignalsForTeachers } from './email/campaign-analytics'
import { prisma } from './prisma'

export { REGISTRATIONS_PAGE_SIZE }

export interface RegistrationFilters {
  search?: string
  courseId?: string
  status?: RegistrationStatus
  emailStatus?: EmailStatus
  marketingConsent?: boolean
  dateFrom?: Date
  dateTo?: Date
}

export interface RegistrationListItem {
  id: string
  reference: string
  registeredAt: Date
  courseId: string
  courseName: string
  teacherId: string
  fullName: string
  email: string
  phone: string
  schoolName: string
  subject: string
  grade: string
  status: RegistrationStatus
  waitlistPosition: number | null
  marketingConsent: boolean
  emailStatus: EmailStatus
  /** How many campaign emails this teacher has been sent (SENT status, across every campaign, not just this course) and when the most recent one went out — the "don't mail them again" signal. */
  campaignEmailCount: number
  lastCampaignEmailAt: Date | null
}

export interface CourseFilterOption {
  id: string
  name: string
}

/** Shared between the registrations table and the Excel export so both always see the same rows for a given filter set. */
export function buildRegistrationWhere(filters: RegistrationFilters): Prisma.RegistrationWhereInput {
  const where: Prisma.RegistrationWhereInput = {}

  if (filters.courseId) where.courseId = filters.courseId
  if (filters.status) where.status = filters.status
  if (filters.emailStatus) where.emailStatus = filters.emailStatus
  if (filters.marketingConsent !== undefined) where.teacher = { marketingConsent: filters.marketingConsent }

  if (filters.dateFrom || filters.dateTo) {
    where.registeredAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { teacher: { fullName: { contains: search, mode: 'insensitive' } } },
      { teacher: { emailOriginal: { contains: search, mode: 'insensitive' } } },
      { teacher: { schoolNameOriginal: { contains: search, mode: 'insensitive' } } },
    ]
  }

  return where
}

function toListItem(
  row: Prisma.RegistrationGetPayload<{ include: { teacher: true; course: { select: { name: true } } } }>,
  campaignSignal: { count: number; lastSentAt: Date | null } | undefined,
): RegistrationListItem {
  return {
    id: row.id,
    reference: row.reference,
    registeredAt: row.registeredAt,
    courseId: row.courseId,
    courseName: row.course.name,
    teacherId: row.teacherId,
    fullName: row.teacher.fullName,
    email: row.teacher.emailOriginal,
    phone: row.teacher.phone,
    schoolName: row.teacher.schoolNameOriginal,
    subject: row.teacher.subjectOriginal,
    grade: row.teacher.gradeOriginal,
    status: row.status,
    waitlistPosition: row.waitlistPosition,
    marketingConsent: row.teacher.marketingConsent,
    emailStatus: row.emailStatus,
    campaignEmailCount: campaignSignal?.count ?? 0,
    lastCampaignEmailAt: campaignSignal?.lastSentAt ?? null,
  }
}

/** Page of registrations for the admin table — never fetches more than one page's worth of rows. The campaign-email signal is one batched query for the whole page's teacherIds, never per-row. */
export async function listRegistrationsForAdmin(
  filters: RegistrationFilters,
  page: number,
): Promise<{ rows: RegistrationListItem[]; totalCount: number }> {
  const where = buildRegistrationWhere(filters)
  const [rows, totalCount] = await Promise.all([
    prisma.registration.findMany({
      where,
      include: { teacher: true, course: { select: { name: true } } },
      orderBy: { registeredAt: 'desc' },
      skip: page * REGISTRATIONS_PAGE_SIZE,
      take: REGISTRATIONS_PAGE_SIZE,
    }),
    prisma.registration.count({ where }),
  ])

  const signals = await getCampaignEmailSignalsForTeachers([...new Set(rows.map((row) => row.teacherId))])

  return { rows: rows.map((row) => toListItem(row, signals.get(row.teacherId))), totalCount }
}

export interface RegistrationCourseGroup {
  courseId: string
  courseName: string
  courseDate: Date
  confirmedCount: number
  waitlistedCount: number
  capacity: number | null
}

/**
 * One row per course with at least one registration matching the current
 * filters, ordered by course date descending — the section list for the "By
 * course" view. confirmedCount, waitlistedCount and capacity describe the
 * course as a whole (same figures as the courses admin screen), not the
 * filtered subset; filters only decide which courses appear here and which
 * registrations are visible once a section is expanded.
 */
export async function listRegistrationCourseGroups(filters: RegistrationFilters): Promise<RegistrationCourseGroup[]> {
  const where = buildRegistrationWhere(filters)
  const matches = await prisma.registration.findMany({ where, select: { courseId: true }, distinct: ['courseId'] })
  const courseIds = matches.map((row) => row.courseId)
  if (courseIds.length === 0) return []

  const [courses, statusCounts] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true, courseDate: true, maxCapacity: true },
      orderBy: { courseDate: 'desc' },
    }),
    prisma.registration.groupBy({
      by: ['courseId', 'status'],
      where: { courseId: { in: courseIds }, status: { in: ['CONFIRMED', 'WAITLISTED'] } },
      _count: { _all: true },
    }),
  ])

  const countsByCourseId = new Map<string, { confirmed: number; waitlisted: number }>()
  for (const row of statusCounts) {
    const entry = countsByCourseId.get(row.courseId) ?? { confirmed: 0, waitlisted: 0 }
    if (row.status === 'CONFIRMED') entry.confirmed = row._count._all
    if (row.status === 'WAITLISTED') entry.waitlisted = row._count._all
    countsByCourseId.set(row.courseId, entry)
  }

  return courses.map((course) => {
    const counts = countsByCourseId.get(course.id) ?? { confirmed: 0, waitlisted: 0 }
    return {
      courseId: course.id,
      courseName: course.name,
      courseDate: course.courseDate,
      confirmedCount: counts.confirmed,
      waitlistedCount: counts.waitlisted,
      capacity: course.maxCapacity,
    }
  })
}

const EXPORT_INCLUDE = { teacher: { include: { school: true } }, course: true } satisfies Prisma.RegistrationInclude

export type ExportRegistrationRow = Prisma.RegistrationGetPayload<{ include: typeof EXPORT_INCLUDE }>

/** All rows matching the filters, for the Excel export — bypasses pagination but reuses the exact same where-clause as the table. */
export async function listAllRegistrationsForExport(filters: RegistrationFilters): Promise<ExportRegistrationRow[]> {
  const where = buildRegistrationWhere(filters)
  return prisma.registration.findMany({
    where,
    include: EXPORT_INCLUDE,
    orderBy: { registeredAt: 'desc' },
  })
}

const STATUS_VALUES = new Set<string>(['CONFIRMED', 'WAITLISTED', 'CANCELLED'])
const EMAIL_STATUS_VALUES = new Set<string>(['PENDING', 'SENT', 'FAILED'])

/** Shared between the registrations page and the export route so a filtered URL always produces the same result set in both places. */
export function parseRegistrationSearchParams(params: Record<string, string | undefined>): RegistrationFilters {
  const filters: RegistrationFilters = {}
  if (params.q?.trim()) filters.search = params.q.trim()
  if (params.courseId) filters.courseId = params.courseId
  if (params.status && STATUS_VALUES.has(params.status)) filters.status = params.status as RegistrationStatus
  if (params.emailStatus && EMAIL_STATUS_VALUES.has(params.emailStatus)) {
    filters.emailStatus = params.emailStatus as EmailStatus
  }
  if (params.consent === 'true') filters.marketingConsent = true
  else if (params.consent === 'false') filters.marketingConsent = false
  if (params.from) filters.dateFrom = cairoDateTimeLocalToUtc(`${params.from}T00:00`)
  if (params.to) filters.dateTo = cairoDateTimeLocalToUtc(`${params.to}T23:59`)
  return filters
}

export async function listCourseFilterOptions(): Promise<CourseFilterOption[]> {
  const courses = await prisma.course.findMany({
    select: { id: true, name: true },
    orderBy: { courseDate: 'desc' },
  })
  return courses
}

export interface RegistrationDetail {
  id: string
  reference: string
  status: RegistrationStatus
  registeredAt: Date
  waitlistPosition: number | null
  promotedAt: Date | null
  cancelledAt: Date | null
  emailStatus: EmailStatus
  emailType: 'CONFIRMED' | 'WAITLISTED' | 'PROMOTED'
  emailError: string | null
  courseId: string
  courseName: string
  courseDate: Date
  teacherId: string
  fullName: string
  email: string
  phone: string
  address: string | null
  schoolName: string
  subject: string
  grade: string
  marketingConsent: boolean
  currency: string
  /** A permanent record of what was applied at submission (or promotion) — never recalculated, so this stays accurate even after the promo code itself is later edited or archived. */
  promoCodeSnapshot: string | null
  discountLabel: string | null
  originalFee: number | null
  finalFee: number | null
}

export async function getRegistrationDetail(id: string): Promise<RegistrationDetail | null> {
  const row = await prisma.registration.findUnique({
    where: { id },
    include: { teacher: true, course: { select: { id: true, name: true, courseDate: true, currency: true } } },
  })
  if (!row) return null

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    registeredAt: row.registeredAt,
    waitlistPosition: row.waitlistPosition,
    promotedAt: row.promotedAt,
    cancelledAt: row.cancelledAt,
    emailStatus: row.emailStatus,
    emailType: row.emailType,
    emailError: row.emailError,
    courseId: row.course.id,
    courseName: row.course.name,
    courseDate: row.course.courseDate,
    teacherId: row.teacher.id,
    fullName: row.teacher.fullName,
    email: row.teacher.emailOriginal,
    phone: row.teacher.phone,
    address: row.teacher.address,
    schoolName: row.teacher.schoolNameOriginal,
    subject: row.teacher.subjectOriginal,
    grade: row.teacher.gradeOriginal,
    marketingConsent: row.teacher.marketingConsent,
    currency: row.course.currency,
    promoCodeSnapshot: row.promoCodeSnapshot,
    discountLabel:
      row.discountTypeSnapshot && row.discountValueSnapshot != null
        ? formatPromoDiscountLabel(row.discountTypeSnapshot, Number(row.discountValueSnapshot), row.course.currency)
        : null,
    originalFee: row.originalFee != null ? Number(row.originalFee) : null,
    finalFee: row.finalFee != null ? Number(row.finalFee) : null,
  }
}
