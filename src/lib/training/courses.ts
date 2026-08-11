import type { Course, CourseCategory, CourseSession, DeliveryMethod } from '@prisma/client'

import { prisma } from './prisma'

/** A client-safe course shape — Prisma's Decimal doesn't serialise across the server/client boundary, so feeAmount is converted to a plain number here. */
export interface CourseDetail {
  id: string
  name: string
  slug: string
  shortDescription: string
  fullDescription: string
  category: CourseCategory
  courseDate: Date
  startTime: Date
  endTime: Date
  durationMinutes: number | null
  /** The specific dates a multi-day course runs on, sorted ascending — empty for a single-day course. */
  sessions: Date[]
  isMultiDay: boolean
  deliveryMethod: DeliveryMethod
  location: string | null
  joiningInstructions: string | null
  feeAmount: number
  currency: string
  registrationOpensAt: Date | null
  registrationClosesAt: Date | null
  maxCapacity: number | null
  waitlistEnabled: boolean
  waitlistCapacity: number | null
  isActive: boolean
  isFeatured: boolean
  archivedAt: Date | null
  zoomLink: string | null
  zoomMeetingId: string | null
  zoomPasscode: string | null
  reminderSubject: string | null
  reminderMessage: string | null
}

export interface AdminCourseListItem extends CourseDetail {
  confirmedCount: number
  waitlistedCount: number
}

function toCourseDetail(course: Course & { sessions: CourseSession[] }): CourseDetail {
  return {
    id: course.id,
    name: course.name,
    slug: course.slug,
    shortDescription: course.shortDescription,
    fullDescription: course.fullDescription,
    category: course.category,
    courseDate: course.courseDate,
    startTime: course.startTime,
    endTime: course.endTime,
    durationMinutes: course.durationMinutes,
    sessions: course.sessions.map((session) => session.sessionDate),
    isMultiDay: course.isMultiDay,
    deliveryMethod: course.deliveryMethod,
    location: course.location,
    joiningInstructions: course.joiningInstructions,
    feeAmount: Number(course.feeAmount),
    currency: course.currency,
    registrationOpensAt: course.registrationOpensAt,
    registrationClosesAt: course.registrationClosesAt,
    maxCapacity: course.maxCapacity,
    waitlistEnabled: course.waitlistEnabled,
    waitlistCapacity: course.waitlistCapacity,
    isActive: course.isActive,
    isFeatured: course.isFeatured,
    archivedAt: course.archivedAt,
    zoomLink: course.zoomLink,
    zoomMeetingId: course.zoomMeetingId,
    zoomPasscode: course.zoomPasscode,
    reminderSubject: course.reminderSubject,
    reminderMessage: course.reminderMessage,
  }
}

/** Course list for the admin screen — registration and waitlist counts are aggregated in SQL via groupBy, never by loading registration rows into memory. */
export async function listCoursesForAdmin(): Promise<AdminCourseListItem[]> {
  const [courses, statusCounts] = await Promise.all([
    prisma.course.findMany({
      orderBy: { courseDate: 'desc' },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    }),
    prisma.registration.groupBy({
      by: ['courseId', 'status'],
      _count: { _all: true },
      where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } },
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
      ...toCourseDetail(course),
      confirmedCount: counts.confirmed,
      waitlistedCount: counts.waitlisted,
    }
  })
}
