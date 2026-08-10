import 'server-only'

import type { ConsentEventSource, ConsentEventType, ConsentSource, Prisma, SubscriberStatus } from '@prisma/client'

import { deriveFirstName } from '@/domain/training/personalization'
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

  // School/subject/grade come only from the linked Teacher — filtering on
  // any of them naturally (and correctly) excludes landing page subscribers
  // with no teacher, since a relation filter never matches a null relation.
  const teacherWhere: Prisma.TeacherWhereInput = {}
  if (filters.schoolId) teacherWhere.schoolId = filters.schoolId
  if (filters.subject) teacherWhere.subjectNormalised = filters.subject
  if (filters.grade) teacherWhere.gradeNormalised = filters.grade
  if (Object.keys(teacherWhere).length > 0) where.teacher = teacherWhere

  // Search spans both a linked Teacher's fields and a landing page
  // subscriber's own stored fullName/emailOriginal — a top-level OR next to
  // (not nested inside) the teacher filter above, so it still ANDs
  // correctly with school/subject/grade/status/etc.
  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { emailOriginal: { contains: search, mode: 'insensitive' } },
      { teacher: { fullName: { contains: search, mode: 'insensitive' } } },
      { teacher: { emailOriginal: { contains: search, mode: 'insensitive' } } },
      { teacher: { schoolNameOriginal: { contains: search, mode: 'insensitive' } } },
    ]
  }

  return where
}

function buildOrderBy(sortField: SubscriberSortField, sortDir: SortDirection): Prisma.SubscriberOrderByWithRelationInput {
  if (sortField === 'name') return { teacher: { fullName: sortDir } }
  if (sortField === 'emailsSent') return { marketingEmailsSent: sortDir }
  return { subscribedAt: sortDir }
}

export interface SubscriberListItem {
  id: string
  teacherId: string | null
  fullName: string
  email: string
  /** Null for a landing page subscriber with no linked teacher. */
  schoolName: string | null
  subject: string | null
  grade: string | null
  subscribedAt: Date
  consentSource: ConsentSource
  status: SubscriberStatus
  lastMarketingEmailAt: Date | null
  marketingEmailsSent: number
}

const LIST_INCLUDE = { teacher: true } satisfies Prisma.SubscriberInclude

/** The linked Teacher is always the fresher, authoritative source once a subscriber is linked; the subscriber's own fullName/emailOriginal only ever matter for a landing page subscriber that has no teacher yet. Exported so the marketing sending engine (Phase D) resolves a recipient's name/email identically to every other admin view — never a second implementation. */
export function resolveDisplayName(row: { fullName: string | null; teacher: { fullName: string } | null }): string {
  return row.teacher?.fullName ?? row.fullName ?? 'Unknown'
}

export function resolveDisplayEmail(row: { emailOriginal: string | null; emailNormalised: string; teacher: { emailOriginal: string } | null }): string {
  return row.teacher?.emailOriginal ?? row.emailOriginal ?? row.emailNormalised
}

function toListItem(row: Prisma.SubscriberGetPayload<{ include: typeof LIST_INCLUDE }>): SubscriberListItem {
  return {
    id: row.id,
    teacherId: row.teacherId,
    fullName: resolveDisplayName(row),
    email: resolveDisplayEmail(row),
    schoolName: row.teacher?.schoolNameOriginal ?? null,
    subject: row.teacher?.subjectOriginal ?? null,
    grade: row.teacher?.gradeOriginal ?? null,
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
  teacherId: string | null
  fullName: string
  email: string
  phone: string | null
  schoolName: string | null
  subject: string | null
  grade: string | null
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
    fullName: resolveDisplayName(row),
    email: resolveDisplayEmail(row),
    phone: row.teacher?.phone ?? null,
    schoolName: row.teacher?.schoolNameOriginal ?? null,
    subject: row.teacher?.subjectOriginal ?? null,
    grade: row.teacher?.gradeOriginal ?? null,
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

/**
 * The single WHERE-clause builder behind every recipient resolution
 * (selection-count summary and the composer's full recipient fetch). The
 * client sends only ids or filter criteria — never who's actually in the
 * audience. status = SUBSCRIBED is re-applied here unconditionally, on top
 * of (mode 'filters') or in addition to (mode 'ids') whatever the client
 * claims, so a stale or malicious client can never smuggle an unsubscribed
 * contact into a send.
 */
function buildForcedSubscribedWhere(criteria: SubscriberSelectionCriteria): Prisma.SubscriberWhereInput | null {
  if (criteria.mode === 'ids') {
    if (criteria.subscriberIds.length === 0) return null
    return { id: { in: criteria.subscriberIds }, status: 'SUBSCRIBED' }
  }
  const filterWhere = buildSubscriberWhere({ ...criteria.filters, status: 'SUBSCRIBED' })
  const excludeIds = criteria.excludeIds ?? []
  return excludeIds.length > 0 ? { AND: [filterWhere, { id: { notIn: excludeIds } }] } : filterWhere
}

export interface ResolvedSubscriberSelection {
  count: number
  subscriberIds: string[]
}

export async function resolveSubscriberSelection(criteria: SubscriberSelectionCriteria): Promise<ResolvedSubscriberSelection> {
  const where = buildForcedSubscribedWhere(criteria)
  if (!where) return { count: 0, subscriberIds: [] }

  const rows = await prisma.subscriber.findMany({ where, select: { id: true } })
  return { count: rows.length, subscriberIds: rows.map((row) => row.id) }
}

export interface MarketingRecipient {
  subscriberId: string
  email: string
  firstName: string
  fullName: string
  /** Empty string for a landing page subscriber with no linked teacher — never null, so it can be dropped straight into a template's {{schoolName}} token. */
  schoolName: string
  unsubscribeToken: string
}

/**
 * Full personalisation data for every recipient a selection resolves to —
 * used only to render the composer's preview in this phase (Phase C ships
 * no sending engine). Same forced-subscribed-only rule as
 * resolveSubscriberSelection; never trust the caller's status claim.
 */
export async function resolveMarketingRecipients(criteria: SubscriberSelectionCriteria): Promise<MarketingRecipient[]> {
  const where = buildForcedSubscribedWhere(criteria)
  if (!where) return []

  const rows = await prisma.subscriber.findMany({ where, include: { teacher: true } })
  return rows.map((row) => {
    const fullName = resolveDisplayName(row)
    return {
      subscriberId: row.id,
      email: resolveDisplayEmail(row),
      firstName: deriveFirstName(fullName),
      fullName,
      schoolName: row.teacher?.schoolNameOriginal ?? '',
      unsubscribeToken: row.unsubscribeToken,
    }
  })
}

// An explicit select, not `include` — unsubscribeToken must never even be
// loaded into memory for the export path, let alone reach the file. This is
// the whole field list buildSubscribersWorkbook reads; add a field there,
// add it here too.
const EXPORT_SELECT = {
  id: true,
  emailNormalised: true,
  fullName: true,
  emailOriginal: true,
  status: true,
  subscribedAt: true,
  consentSource: true,
  lastMarketingEmailAt: true,
  marketingEmailsSent: true,
  teacher: { select: { fullName: true, emailOriginal: true, phone: true, schoolNameOriginal: true, subjectOriginal: true, gradeOriginal: true } },
  consentCourse: { select: { name: true } },
} satisfies Prisma.SubscriberSelect

export type ExportSubscriberRow = Prisma.SubscriberGetPayload<{ select: typeof EXPORT_SELECT }>

/** All rows matching the filters, for the Excel export — bypasses pagination but reuses the exact same where-clause as the table, so a filtered URL always produces the same result set in both places. */
export async function listAllSubscribersForExport(filters: SubscriberFilters): Promise<ExportSubscriberRow[]> {
  const where = buildSubscriberWhere(filters)
  return prisma.subscriber.findMany({
    where,
    select: EXPORT_SELECT,
    orderBy: { subscribedAt: 'desc' },
  })
}
