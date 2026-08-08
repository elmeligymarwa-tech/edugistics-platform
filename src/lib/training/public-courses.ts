import type { CourseCategory, DeliveryMethod } from '@prisma/client'

import { prisma } from './prisma'
import { isCourseOpenForRegistration } from './registration-window'

/** A course as shown on the public /training registration page — only courses currently open for registration ever reach this shape. */
export interface PublicCourse {
  id: string
  name: string
  shortDescription: string
  category: CourseCategory
  courseDate: Date
  startTime: Date
  endTime: Date
  deliveryMethod: DeliveryMethod
  location: string | null
  feeAmount: number
  currency: string
  waitlistEnabled: boolean
  isFull: boolean
}

/** isActive, archivedAt and the registration window are re-checked here — this is the list a real visitor sees, not a cache of admin intent. */
export async function listPublicCourses(): Promise<PublicCourse[]> {
  const now = new Date()
  const courses = await prisma.course.findMany({
    where: { isActive: true, archivedAt: null },
    orderBy: { courseDate: 'asc' },
  })

  const openCourses = courses.filter((course) => isCourseOpenForRegistration(course, now))
  if (openCourses.length === 0) return []

  const confirmedCounts = await prisma.registration.groupBy({
    by: ['courseId'],
    _count: { _all: true },
    where: { courseId: { in: openCourses.map((course) => course.id) }, status: 'CONFIRMED' },
  })
  const confirmedByCourseId = new Map(confirmedCounts.map((row) => [row.courseId, row._count._all]))

  return openCourses.map((course) => {
    const confirmedCount = confirmedByCourseId.get(course.id) ?? 0
    const isFull = course.maxCapacity != null && confirmedCount >= course.maxCapacity
    return {
      id: course.id,
      name: course.name,
      shortDescription: course.shortDescription,
      category: course.category,
      courseDate: course.courseDate,
      startTime: course.startTime,
      endTime: course.endTime,
      deliveryMethod: course.deliveryMethod,
      location: course.location,
      feeAmount: Number(course.feeAmount),
      currency: course.currency,
      waitlistEnabled: course.waitlistEnabled,
      isFull,
    }
  })
}
