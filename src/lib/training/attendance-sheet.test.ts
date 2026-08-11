import { afterAll, describe, expect, it } from 'vitest'

import { prisma } from './prisma'
import {
  CourseNotFoundError,
  SessionNotFoundError,
  SessionRequiredError,
  listRegistrationsForAttendanceSheet,
} from './attendance-sheet'

// Self-contained and self-cleaning, hitting the real database like the
// other export/registrations integration suites.
const MARKER = 'attendance-sheet-test'
const courseIds: string[] = []
const teacherIds: string[] = []

async function makeCourse(overrides: Partial<Parameters<typeof prisma.course.create>[0]['data']> = {}) {
  const slug = `${MARKER}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const course = await prisma.course.create({
    data: {
      name: `${MARKER} course`,
      slug,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      isActive: true,
      ...overrides,
    },
  })
  courseIds.push(course.id)
  return course
}

let teacherCounter = 0
async function makeTeacher(fullName: string) {
  teacherCounter += 1
  const email = `${MARKER}-${Date.now()}-${teacherCounter}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName,
      phone: `+2010000${teacherCounter}`,
      phoneNormalised: `+2010000${teacherCounter}`,
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
  teacherIds.push(teacher.id)
  return teacher
}

let refCounter = 0
async function makeRegistration(
  courseId: string,
  teacherId: string,
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED',
  courseName: string,
) {
  refCounter += 1
  return prisma.registration.create({
    data: {
      reference: `${MARKER}-${Date.now()}-${refCounter}`,
      teacherId,
      courseId,
      courseNameSnapshot: courseName,
      courseDateSnapshot: new Date('2026-09-01T00:00:00.000Z'),
      courseFeeSnapshot: 0,
      courseCurrencySnapshot: 'EGP',
      status,
      waitlistPosition: status === 'WAITLISTED' ? 1 : null,
      emailType: status === 'WAITLISTED' ? 'WAITLISTED' : 'CONFIRMED',
    },
  })
}

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { courseId: { in: courseIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('listRegistrationsForAttendanceSheet', () => {
  it('lists only confirmed registrations by default, excluding waitlisted and cancelled', async () => {
    const course = await makeCourse()
    const confirmed = await makeTeacher('Confirmed Teacher')
    const waitlisted = await makeTeacher('Waitlisted Teacher')
    const cancelled = await makeTeacher('Cancelled Teacher')
    await makeRegistration(course.id, confirmed.id, 'CONFIRMED', course.name)
    await makeRegistration(course.id, waitlisted.id, 'WAITLISTED', course.name)
    await makeRegistration(course.id, cancelled.id, 'CANCELLED', course.name)

    const data = await listRegistrationsForAttendanceSheet(course.id, false, null)

    expect(data.rows).toHaveLength(1)
    expect(data.rows[0]!.teacherFullName).toBe('Confirmed Teacher')
    expect(data.rows[0]!.status).toBe('CONFIRMED')
    // Single-day course — no session selection needed, sheet has no session scope.
    expect(data.session).toBeNull()
    // Mobile number comes straight from the registration's teacher.
    expect(data.rows[0]!.mobileNumber).toBe(confirmed.phone)
  })

  it('adds waitlisted rows when included, distinctly marked by status, and still excludes cancelled', async () => {
    const course = await makeCourse()
    const confirmed = await makeTeacher('Adams Confirmed')
    const waitlisted = await makeTeacher('Baker Waitlisted')
    const cancelled = await makeTeacher('Zed Cancelled')
    await makeRegistration(course.id, confirmed.id, 'CONFIRMED', course.name)
    await makeRegistration(course.id, waitlisted.id, 'WAITLISTED', course.name)
    await makeRegistration(course.id, cancelled.id, 'CANCELLED', course.name)

    const data = await listRegistrationsForAttendanceSheet(course.id, true, null)

    expect(data.rows).toHaveLength(2)
    expect(data.rows.some((row) => row.status === 'CANCELLED')).toBe(false)
    const waitlistedRow = data.rows.find((row) => row.teacherFullName === 'Baker Waitlisted')
    expect(waitlistedRow?.status).toBe('WAITLISTED')
    const confirmedRow = data.rows.find((row) => row.teacherFullName === 'Adams Confirmed')
    expect(confirmedRow?.status).toBe('CONFIRMED')
  })

  it('is scoped to exactly one course and never mixes in another course’s registrations', async () => {
    const courseA = await makeCourse({ name: `${MARKER} course A` })
    const courseB = await makeCourse({ name: `${MARKER} course B` })
    const teacherA = await makeTeacher('Course A Teacher')
    const teacherB = await makeTeacher('Course B Teacher')
    await makeRegistration(courseA.id, teacherA.id, 'CONFIRMED', courseA.name)
    await makeRegistration(courseB.id, teacherB.id, 'CONFIRMED', courseB.name)

    const data = await listRegistrationsForAttendanceSheet(courseA.id, false, null)

    expect(data.rows).toHaveLength(1)
    expect(data.rows[0]!.teacherFullName).toBe('Course A Teacher')
    expect(data.course.id).toBe(courseA.id)
  })

  it('throws for an unknown course id rather than silently returning an empty sheet', async () => {
    await expect(listRegistrationsForAttendanceSheet('does-not-exist', false, null)).rejects.toThrow(CourseNotFoundError)
  })

  it('sorts alphabetically by surname, handling single-word names sensibly', async () => {
    const course = await makeCourse()
    // "Zed" (single word — sorts by itself), "Amy Baker" (surname Baker),
    // "Amy Adams" (surname Adams) — expected order: Adams, Baker, Zed.
    const zed = await makeTeacher('Zed')
    const amyBaker = await makeTeacher('Amy Baker')
    const amyAdams = await makeTeacher('Amy Adams')
    await makeRegistration(course.id, zed.id, 'CONFIRMED', course.name)
    await makeRegistration(course.id, amyBaker.id, 'CONFIRMED', course.name)
    await makeRegistration(course.id, amyAdams.id, 'CONFIRMED', course.name)

    const data = await listRegistrationsForAttendanceSheet(course.id, false, null)

    expect(data.rows.map((row) => row.teacherFullName)).toEqual(['Amy Adams', 'Amy Baker', 'Zed'])
  })
})

describe('listRegistrationsForAttendanceSheet — multi-day session scoping', () => {
  async function makeMultiDayCourse() {
    const sessionDates = [
      new Date('2026-09-05T00:00:00.000Z'),
      new Date('2026-09-12T00:00:00.000Z'),
      new Date('2026-09-19T00:00:00.000Z'),
    ]
    return makeCourse({
      isMultiDay: true,
      durationMinutes: null,
      courseDate: sessionDates[0]!,
      sessions: { create: sessionDates.map((sessionDate) => ({ sessionDate })) },
    })
  }

  it('requires a sessionId for a multi-day course rather than generating an ambiguous sheet', async () => {
    const course = await makeMultiDayCourse()
    await expect(listRegistrationsForAttendanceSheet(course.id, false, null)).rejects.toThrow(SessionRequiredError)
  })

  it('rejects a sessionId that does not belong to the course', async () => {
    const course = await makeMultiDayCourse()
    await expect(listRegistrationsForAttendanceSheet(course.id, false, 'not-a-real-session-id')).rejects.toThrow(
      SessionNotFoundError,
    )
  })

  it('scopes the sheet to one session date and reports the correct session number out of the total', async () => {
    const created = await makeMultiDayCourse()
    const course = await prisma.course.findUniqueOrThrow({
      where: { id: created.id },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    })
    const teacher = await makeTeacher('Multi Day Teacher')
    await makeRegistration(course.id, teacher.id, 'CONFIRMED', course.name)

    const middleSession = course.sessions[1]!
    const data = await listRegistrationsForAttendanceSheet(course.id, false, middleSession.id)

    expect(data.session).toEqual({ sessionDate: middleSession.sessionDate, sessionNumber: 2, totalSessions: 3 })
    // The roster isn't filtered by session — a registration is for the
    // whole course, so the same rows print on every session's sheet.
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0]!.mobileNumber).toBe(teacher.phone)
  })
})
