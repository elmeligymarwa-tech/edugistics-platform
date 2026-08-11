import 'server-only'

import type { RegistrationStatus } from '@prisma/client'

import { deriveSurname } from '@/domain/training/personalization'
import { prisma } from './prisma'

export class CourseNotFoundError extends Error {}

export interface AttendanceSheetRow {
  registrationId: string
  teacherFullName: string
  courseName: string
  registeredAt: Date
  reference: string
  status: RegistrationStatus
}

export interface AttendanceSheetCourse {
  id: string
  name: string
  courseDate: Date
  endDate: Date | null
  isMultiDay: boolean
}

export interface AttendanceSheetData {
  course: AttendanceSheetCourse
  rows: AttendanceSheetRow[]
  includeWaitlisted: boolean
}

/**
 * Confirmed registrations for exactly one course — cancelled registrations
 * are excluded unconditionally, and waitlisted ones only when
 * includeWaitlisted is set. Never mixes courses: the query itself is
 * scoped to courseId, not filtered client-side after a broader fetch.
 *
 * Sorted alphabetically by surname (see deriveSurname), falling back to the
 * full name when two rows share a derived surname — including when both
 * are single-word names and so are "the same surname" by definition —
 * which keeps the ordering deterministic rather than depending on
 * whatever order Postgres happens to return rows in.
 */
export async function listRegistrationsForAttendanceSheet(courseId: string, includeWaitlisted: boolean): Promise<AttendanceSheetData> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, courseDate: true, endDate: true, isMultiDay: true },
  })
  if (!course) throw new CourseNotFoundError(`Course ${courseId} not found.`)

  const statuses: RegistrationStatus[] = includeWaitlisted ? ['CONFIRMED', 'WAITLISTED'] : ['CONFIRMED']

  const registrations = await prisma.registration.findMany({
    where: { courseId, status: { in: statuses } },
    select: {
      id: true,
      reference: true,
      registeredAt: true,
      status: true,
      courseNameSnapshot: true,
      teacher: { select: { fullName: true } },
    },
  })

  const rows: AttendanceSheetRow[] = registrations.map((registration) => ({
    registrationId: registration.id,
    teacherFullName: registration.teacher.fullName,
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

  return { course, rows, includeWaitlisted }
}
