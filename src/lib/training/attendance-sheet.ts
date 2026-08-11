import 'server-only'

import type { RegistrationStatus } from '@prisma/client'

import { deriveSurname } from '@/domain/training/personalization'
import { prisma } from './prisma'

export class CourseNotFoundError extends Error {}

/** A multi-day course was selected but no sessionId query param was given — the sheet would otherwise be ambiguous about which day it's for. */
export class SessionRequiredError extends Error {}

/** The given sessionId doesn't belong to this course (wrong course, stale link, or a since-removed session). */
export class SessionNotFoundError extends Error {}

export interface AttendanceSheetRow {
  registrationId: string
  teacherFullName: string
  mobileNumber: string
  courseName: string
  registeredAt: Date
  reference: string
  status: RegistrationStatus
}

export interface AttendanceSheetCourse {
  id: string
  name: string
  courseDate: Date
  isMultiDay: boolean
  sessions: { id: string; sessionDate: Date }[]
}

export interface AttendanceSheetData {
  course: AttendanceSheetCourse
  rows: AttendanceSheetRow[]
  includeWaitlisted: boolean
  /** Null for a single-day course — a multi-day course's sheet is always scoped to exactly one of these. */
  session: { sessionDate: Date; sessionNumber: number; totalSessions: number } | null
}

/**
 * Confirmed registrations for exactly one course — cancelled registrations
 * are excluded unconditionally, and waitlisted ones only when
 * includeWaitlisted is set. Never mixes courses: the query itself is
 * scoped to courseId, not filtered client-side after a broader fetch.
 *
 * The registration roster is never filtered by session: a registration is
 * for the whole course, not a single day, so the same roster prints on
 * every session's sheet — sessionId only decides which day's header the
 * sheet is printed for, and staff take attendance against the same list by
 * hand on each date.
 *
 * Sorted alphabetically by surname (see deriveSurname), falling back to the
 * full name when two rows share a derived surname — including when both
 * are single-word names and so are "the same surname" by definition —
 * which keeps the ordering deterministic rather than depending on
 * whatever order Postgres happens to return rows in.
 */
export async function listRegistrationsForAttendanceSheet(
  courseId: string,
  includeWaitlisted: boolean,
  sessionId: string | null,
): Promise<AttendanceSheetData> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      courseDate: true,
      isMultiDay: true,
      sessions: { orderBy: { sessionDate: 'asc' }, select: { id: true, sessionDate: true } },
    },
  })
  if (!course) throw new CourseNotFoundError(`Course ${courseId} not found.`)

  let session: AttendanceSheetData['session'] = null
  if (course.isMultiDay) {
    if (!sessionId) throw new SessionRequiredError('Select a session date to print an attendance sheet for.')
    const index = course.sessions.findIndex((s) => s.id === sessionId)
    if (index === -1) throw new SessionNotFoundError(`Session ${sessionId} not found on course ${courseId}.`)
    session = { sessionDate: course.sessions[index]!.sessionDate, sessionNumber: index + 1, totalSessions: course.sessions.length }
  }

  const statuses: RegistrationStatus[] = includeWaitlisted ? ['CONFIRMED', 'WAITLISTED'] : ['CONFIRMED']

  const registrations = await prisma.registration.findMany({
    where: { courseId, status: { in: statuses } },
    select: {
      id: true,
      reference: true,
      registeredAt: true,
      status: true,
      courseNameSnapshot: true,
      teacher: { select: { fullName: true, phone: true } },
    },
  })

  const rows: AttendanceSheetRow[] = registrations.map((registration) => ({
    registrationId: registration.id,
    teacherFullName: registration.teacher.fullName,
    mobileNumber: registration.teacher.phone,
    courseName: registration.courseNameSnapshot,
    registeredAt: registration.registeredAt,
    reference: registration.reference,
    status: registration.status,
  }))

  rows.sort((a, b) => {
    const surnameCompare = deriveSurname(a.teacherFullName).localeCompare(deriveSurname(b.teacherFullName))
    if (surnameCompare !== 0) return surnameCompare
    return a.teacherFullName.localeCompare(b.teacherFullName)
  })

  return { course, rows, includeWaitlisted, session }
}
