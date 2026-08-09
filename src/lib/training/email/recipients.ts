import 'server-only'

import type { Prisma } from '@prisma/client'

import { formatCourseDateLong, formatCourseTimeRange } from '@/domain/training/format'
import { deriveFirstName, type PersonalizationValues } from '@/domain/training/personalization'
import { buildRegistrationWhere, type RegistrationFilters } from '../registrations'
import { prisma } from '../prisma'

export type RecipientSelectionCriteria =
  | { mode: 'ids'; registrationIds: string[]; includeWaitlisted?: boolean }
  | { mode: 'filters'; filters: RegistrationFilters; excludeIds?: string[]; includeWaitlisted?: boolean }

export interface ResolvedRecipient {
  teacherId: string
  registrationId: string
  email: string
  fullName: string
  firstName: string
  courseId: string
  courseName: string
  courseDate: string
  courseTime: string
  schoolName: string
  zoomLink: string | null
  reminderSubject: string | null
  reminderMessage: string | null
  reference: string
}

export interface RecipientResolution {
  recipients: ResolvedRecipient[]
  /** Registration rows matching the selection, after cancelled/waitlist exclusions but before de-duplication by teacher. */
  rawRegistrationCount: number
  /** De-duplicated by normalised teacher email — this is the real number of emails that would be sent. */
  uniqueTeacherCount: number
  courses: { id: string; name: string }[]
  waitlistedRawCount: number
}

const RECIPIENT_INCLUDE = {
  teacher: { include: { school: true } },
  course: true,
} satisfies Prisma.RegistrationInclude

const EMPTY_RESOLUTION: RecipientResolution = {
  recipients: [],
  rawRegistrationCount: 0,
  uniqueTeacherCount: 0,
  courses: [],
  waitlistedRawCount: 0,
}

/**
 * Resolves the real, current set of recipients for a selection — the only
 * place recipient emails, names, course fields and Zoom links are read for
 * the bulk composer. The client only ever supplies registration ids or
 * filter criteria; every field used to build or preview an email is fetched
 * fresh here, never trusted from the caller.
 *
 * Cancelled registrations are always excluded. Waitlisted registrations are
 * excluded unless includeWaitlisted is set. Recipients are de-duplicated by
 * normalised teacher email — a teacher with two matching registrations
 * counts once; the most recently registered of their matching registrations
 * supplies that one email's course context.
 */
export async function resolveRecipients(criteria: RecipientSelectionCriteria): Promise<RecipientResolution> {
  const includeWaitlisted = criteria.includeWaitlisted ?? false
  const statusWhere: Prisma.RegistrationWhereInput = includeWaitlisted
    ? { status: { in: ['CONFIRMED', 'WAITLISTED'] } }
    : { status: 'CONFIRMED' }

  let baseWhere: Prisma.RegistrationWhereInput
  if (criteria.mode === 'ids') {
    if (criteria.registrationIds.length === 0) return EMPTY_RESOLUTION
    baseWhere = { id: { in: criteria.registrationIds } }
  } else {
    const filterWhere = buildRegistrationWhere(criteria.filters)
    const excludeIds = criteria.excludeIds ?? []
    baseWhere = excludeIds.length > 0 ? { AND: [filterWhere, { id: { notIn: excludeIds } }] } : filterWhere
  }

  const where: Prisma.RegistrationWhereInput = { AND: [baseWhere, statusWhere] }

  const rows = await prisma.registration.findMany({
    where,
    include: RECIPIENT_INCLUDE,
    orderBy: { registeredAt: 'desc' },
  })

  if (rows.length === 0) return EMPTY_RESOLUTION

  const waitlistedRawCount = rows.filter((row) => row.status === 'WAITLISTED').length

  const byEmail = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    // Rows are ordered registeredAt desc, so the first row seen per teacher is their most recent matching registration.
    if (!byEmail.has(row.teacher.emailNormalised)) byEmail.set(row.teacher.emailNormalised, row)
  }

  const recipients: ResolvedRecipient[] = [...byEmail.values()].map((row) => ({
    teacherId: row.teacher.id,
    registrationId: row.id,
    email: row.teacher.emailOriginal,
    fullName: row.teacher.fullName,
    firstName: deriveFirstName(row.teacher.fullName),
    courseId: row.course.id,
    courseName: row.course.name,
    courseDate: formatCourseDateLong(row.course.courseDate),
    courseTime: formatCourseTimeRange(row.course.startTime, row.course.endTime),
    schoolName: row.teacher.school?.canonicalName ?? row.teacher.schoolNameOriginal,
    zoomLink: row.course.zoomLink,
    reminderSubject: row.course.reminderSubject,
    reminderMessage: row.course.reminderMessage,
    reference: row.reference,
  }))

  const courseMap = new Map<string, string>()
  for (const recipient of recipients) courseMap.set(recipient.courseId, recipient.courseName)

  return {
    recipients,
    rawRegistrationCount: rows.length,
    uniqueTeacherCount: recipients.length,
    courses: [...courseMap.entries()].map(([id, name]) => ({ id, name })),
    waitlistedRawCount,
  }
}

/** The single place a ResolvedRecipient becomes token values — used by both the preview and the real send so the two can never resolve a token differently. */
export function toPersonalizationValues(recipient: ResolvedRecipient): PersonalizationValues {
  return {
    firstName: recipient.firstName,
    fullName: recipient.fullName,
    courseName: recipient.courseName,
    courseDate: recipient.courseDate,
    courseTime: recipient.courseTime,
    schoolName: recipient.schoolName,
    zoomLink: recipient.zoomLink ?? '',
    reference: recipient.reference,
  }
}
