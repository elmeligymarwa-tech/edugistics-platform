import 'server-only'

import { prisma } from './prisma'

export interface WaitlistRow {
  id: string
  reference: string
  waitlistPosition: number
  fullName: string
  email: string
  phone: string
  schoolName: string
  registeredAt: Date
}

export interface WaitlistPageData {
  courseId: string
  courseName: string
  maxCapacity: number | null
  confirmedCount: number
  remainingSeats: number | null
  waitlist: WaitlistRow[]
}

export async function getWaitlistPageData(courseId: string): Promise<WaitlistPageData | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course) return null

  const [confirmedCount, waitlisted] = await Promise.all([
    prisma.registration.count({ where: { courseId, status: 'CONFIRMED' } }),
    prisma.registration.findMany({
      where: { courseId, status: 'WAITLISTED' },
      include: { teacher: true },
      orderBy: { waitlistPosition: 'asc' },
    }),
  ])

  return {
    courseId: course.id,
    courseName: course.name,
    maxCapacity: course.maxCapacity,
    confirmedCount,
    remainingSeats: course.maxCapacity == null ? null : course.maxCapacity - confirmedCount,
    waitlist: waitlisted.map((row) => ({
      id: row.id,
      reference: row.reference,
      waitlistPosition: row.waitlistPosition ?? 0,
      fullName: row.teacher.fullName,
      email: row.teacher.emailOriginal,
      phone: row.teacher.phone,
      schoolName: row.teacher.schoolNameOriginal,
      registeredAt: row.registeredAt,
    })),
  }
}
