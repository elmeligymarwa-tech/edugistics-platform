import 'server-only'

import type { ConsentEventSource, ConsentEventType, ConsentSource, Prisma, SubscriberStatus } from '@prisma/client'

import {
  SUBSCRIBERS_PAGE_SIZE,
  type SortDirection,
  type SubscriberFilters,
  type SubscriberSortField,
} from '@/domain/training/subscriber-filters'
import { prisma } from './prisma'

export { SUBSCRIBERS_PAGE_SIZE }

/** Shared between the subscribers table, the recipient resolver and the Excel export so all three always see the same rows for a given filter set. */
export function buildSubscriberWhere(filters: SubscriberFilters): Prisma.SubscriberWhereInput {
  const where: Prisma.SubscriberWhereInput = {}

  if (filters.status !== 'ALL') where.status = filters.status
  if (filters.consentCourseId) where.consentCourseId = filters.consentCourseId
  if (filters.source) where.consentSource = filters.source
  if (filters.dateFrom || filters.dateTo) {
    where.subscribedAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }

  const teacherWhere: Prisma.TeacherWhereInput = {}
  if (filters.schoolId) teacherWhere.schoolId = filters.schoolId
  if (filters.subject) teacherWhere.subjectNormalised = filters.subject
  if (filters.grade) teacherWhere.gradeNormalised = filters.grade

  const search = filters.search?.trim()
  if (search) {
    teacherWhere.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { emailOriginal: { contains: search, mode: 'insensitive' } },
      { schoolNameOriginal: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (Object.keys(teacherWhere).length > 0) where.teacher = teacherWhere

  return where
}

function buildOrderBy(sortField: SubscriberSortField, sortDir: SortDirection): Prisma.SubscriberOrderByWithRelationInput {
  if (sortField === 'name') return { teacher: { fullName: sortDir } }
  if (sortField === 'emailsSent') return { marketingEmailsSent: sortDir }
  return { subscribedAt: sortDir }
}

export interface SubscriberListItem {
  id: string
  teacherId: string
  fullName: string
  email: string
  schoolName: string
  subject: string
  grade: string
  subscribedAt: Date
  consentSource: ConsentSource
  status: SubscriberStatus
  lastMarketingEmailAt: Date | null
  marketingEmailsSent: number
}

const LIST_INCLUDE = { teacher: true } satisfies Prisma.SubscriberInclude

function toListItem(row: Prisma.SubscriberGetPayload<{ include: typeof LIST_INCLUDE }>): SubscriberListItem {
  return {
    id: row.id,
    teacherId: row.teacherId,
    fullName: row.teacher.fullName,
    email: row.teacher.emailOriginal,
    schoolName: row.teacher.schoolNameOriginal,
    subject: row.teacher.subjectOriginal,
    grade: row.teacher.gradeOriginal,
    subscribedAt: row.subscribedAt,
    consentSource: row.consentSource,
    status: row.status,
    lastMarketingEmailAt: row.lastMarketingEmailAt,
    marketingEmailsSent: row.marketingEmailsSent,
  }
}

/** Server-side pagination, SUBSCRIBERS_PAGE_SIZE rows per page — never loads the full list into the browser. */
export async function listSubscribersForAdmin(
  filters: SubscriberFilters,
  page: number,
  sortField: SubscriberSortField = 'subscribedAt',
  sortDir: SortDirection = 'desc',
): Promise<{ rows: SubscriberListItem[]; totalCount: number }> {
  const where = buildSubscriberWhere(filters)
  const [rows, totalCount] = await Promise.all([
    prisma.subscriber.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: buildOrderBy(sortField, sortDir),
      skip: page * SUBSCRIBERS_PAGE_SIZE,
      take: SUBSCRIBERS_PAGE_SIZE,
    }),
    prisma.subscriber.count({ where }),
  ])
  return { rows: rows.map(toListItem), totalCount }
}

export interface SubscriberFilterOptions {
  schools: { id: string; name: string }[]
  subjects: { value: string; label: string }[]
  grades: { value: string; label: string }[]
  courses: { id: string; name: string }[]
}

/** Every option here comes from data teachers actually submitted, scoped to teachers who hold a Subscriber row (of either status) — never a hardcoded list. */
export async function listSubscriberFilterOptions(): Promise<SubscriberFilterOptions> {
  const [schools, subjectRows, gradeRows, courses] = await Promise.all([
    prisma.school.findMany({
      where: { teachers: { some: { subscriber: {} } } },
      select: { id: true, canonicalName: true },
      orderBy: { canonicalName: 'asc' },
    }),
    prisma.teacher.findMany({
      where: { subscriber: {} },
      select: { subjectNormalised: true, subjectOriginal: true },
      distinct: ['subjectNormalised'],
      orderBy: { subjectOriginal: 'asc' },
    }),
    prisma.teacher.findMany({
      where: { subscriber: {} },
      select: { gradeNormalised: true, gradeOriginal: true },
      distinct: ['gradeNormalised'],
      orderBy: { gradeOriginal: 'asc' },
    }),
    prisma.course.findMany({
      where: { subscribers: { some: {} } },
      select: { id: true, name: true },
      orderBy: { courseDate: 'desc' },
    }),
  ])

  return {
    schools: schools.map((school) => ({ id: school.id, name: school.canonicalName })),
    subjects: subjectRows.map((row) => ({ value: row.subjectNormalised, label: row.subjectOriginal })),
    grades: gradeRows.map((row) => ({ value: row.gradeNormalised, label: row.gradeOriginal })),
    courses,
  }
}

export interface SubscriberConsentEventItem {
  id: string
  eventType: ConsentEventType
  source: ConsentEventSource
  courseId: string | null
  courseName: string | null
  wordingVersion: string | null
  occurredAt: Date
}

export interface SubscriberDetail {
  id: string
  teacherId: string
  fullName: string
  email: string
  phone: string
  schoolName: string
  subject: string
  grade: string
  status: SubscriberStatus
  subscribedAt: Date
  unsubscribedAt: Date | null
  consentSource: ConsentSource
  consentCourseId: string | null
  consentCourseName: string | null
  consentWordingVersion: string
  marketingEmailsSent: number
  lastMarketingEmailAt: Date | null
  events: SubscriberConsentEventItem[]
}

/** The evidence trail for one subscriber — every field here is read-only in the UI; ConsentEvent rows are never edited or deleted by application code. */
export async function getSubscriberDetail(id: string): Promise<SubscriberDetail | null> {
  const row = await prisma.subscriber.findUnique({
    where: { id },
    include: {
      teacher: true,
      consentCourse: { select: { name: true } },
      consentEvents: { orderBy: { occurredAt: 'asc' }, include: { course: { select: { name: true } } } },
    },
  })
  if (!row) return null

  return {
    id: row.id,
    teacherId: row.teacherId,
    fullName: row.teacher.fullName,
    email: row.teacher.emailOriginal,
    phone: row.teacher.phone,
    schoolName: row.teacher.schoolNameOriginal,
    subject: row.teacher.subjectOriginal,
    grade: row.teacher.gradeOriginal,
    status: row.status,
    subscribedAt: row.subscribedAt,
    unsubscribedAt: row.unsubscribedAt,
    consentSource: row.consentSource,
    consentCourseId: row.consentCourseId,
    consentCourseName: row.consentCourse?.name ?? null,
    consentWordingVersion: row.consentWordingVersion,
    marketingEmailsSent: row.marketingEmailsSent,
    lastMarketingEmailAt: row.lastMarketingEmailAt,
    events: row.consentEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      courseId: event.courseId,
      courseName: event.course?.name ?? null,
      wordingVersion: event.wordingVersion,
      occurredAt: event.occurredAt,
    })),
  }
}

export type SubscriberSelectionCriteria =
  | { mode: 'ids'; subscriberIds: string[] }
  | { mode: 'filters'; filters: SubscriberFilters; excludeIds?: string[] }

export interface ResolvedSubscriberSelection {
  count: number
  subscriberIds: string[]
}

/**
 * Server-side recipient resolution. The client sends only ids or filter
 * criteria — never who's actually in the audience. status = SUBSCRIBED is
 * re-applied here unconditionally, on top of (mode 'filters') or in
 * addition to (mode 'ids') whatever the client claims, so a stale or
 * malicious client can never smuggle an unsubscribed contact into a send.
 */
export async function resolveSubscriberSelection(criteria: SubscriberSelectionCriteria): Promise<ResolvedSubscriberSelection> {
  let where: Prisma.SubscriberWhereInput

  if (criteria.mode === 'ids') {
    if (criteria.subscriberIds.length === 0) return { count: 0, subscriberIds: [] }
    where = { id: { in: criteria.subscriberIds }, status: 'SUBSCRIBED' }
  } else {
    const filterWhere = buildSubscriberWhere({ ...criteria.filters, status: 'SUBSCRIBED' })
    const excludeIds = criteria.excludeIds ?? []
    where = excludeIds.length > 0 ? { AND: [filterWhere, { id: { notIn: excludeIds } }] } : filterWhere
  }

  const rows = await prisma.subscriber.findMany({ where, select: { id: true } })
  return { count: rows.length, subscriberIds: rows.map((row) => row.id) }
}

const EXPORT_INCLUDE = { teacher: true, consentCourse: { select: { name: true } } } satisfies Prisma.SubscriberInclude

export type ExportSubscriberRow = Prisma.SubscriberGetPayload<{ include: typeof EXPORT_INCLUDE }>

/** All rows matching the filters, for the Excel export — bypasses pagination but reuses the exact same where-clause as the table, so a filtered URL always produces the same result set in both places. */
export async function listAllSubscribersForExport(filters: SubscriberFilters): Promise<ExportSubscriberRow[]> {
  const where = buildSubscriberWhere(filters)
  return prisma.subscriber.findMany({
    where,
    include: EXPORT_INCLUDE,
    orderBy: { subscribedAt: 'desc' },
  })
}
