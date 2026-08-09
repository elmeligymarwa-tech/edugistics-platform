import { afterAll, describe, expect, it } from 'vitest'

import { prisma } from '../prisma'
import { resolveRecipients } from './recipients'

// Self-contained and self-cleaning; hits the real database, since recipient
// resolution's de-duplication and status filtering have no mockable
// boundary from Postgres (the same pattern used by the waitlist promotion
// action test).
const MARKER = 'recipients-test'
const courseIds: string[] = []
const teacherIds: string[] = []
const registrationIds: string[] = []

async function makeCourse(name: string, overrides: Partial<{ zoomLink: string | null; reminderSubject: string | null; reminderMessage: string | null }> = {}) {
  const course = await prisma.course.create({
    data: {
      name: `${MARKER} ${name}`,
      slug: `${MARKER}-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      zoomLink: overrides.zoomLink ?? null,
      reminderSubject: overrides.reminderSubject ?? null,
      reminderMessage: overrides.reminderMessage ?? null,
    },
  })
  courseIds.push(course.id)
  return course
}

async function makeTeacher(index: number, fullName = `${MARKER} Teacher ${index}`) {
  const email = `${MARKER}-${index}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName,
      phone: `+2010000${index}`,
      phoneNormalised: `+2010000${index}`,
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

async function makeRegistration(
  teacherId: string,
  courseId: string,
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED',
  registeredAt = new Date(),
) {
  const registration = await prisma.registration.create({
    data: {
      reference: `${MARKER}-${teacherId}-${courseId}`,
      teacherId,
      courseId,
      courseNameSnapshot: 'x',
      courseDateSnapshot: new Date('2026-09-01T00:00:00.000Z'),
      courseFeeSnapshot: 0,
      courseCurrencySnapshot: 'EGP',
      status,
      registeredAt,
      emailType: status === 'WAITLISTED' ? 'WAITLISTED' : 'CONFIRMED',
    },
  })
  registrationIds.push(registration.id)
  return registration
}

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('resolveRecipients', () => {
  it('de-duplicates by teacher email — a teacher with two matching registrations counts once', async () => {
    const courseA = await makeCourse('dedupe-a')
    const courseB = await makeCourse('dedupe-b')
    const teacher = await makeTeacher(1)
    const regA = await makeRegistration(teacher.id, courseA.id, 'CONFIRMED', new Date('2026-01-01'))
    const regB = await makeRegistration(teacher.id, courseB.id, 'CONFIRMED', new Date('2026-01-02'))

    const resolution = await resolveRecipients({ mode: 'ids', registrationIds: [regA.id, regB.id] })
    expect(resolution.recipients).toHaveLength(1)
    expect(resolution.uniqueTeacherCount).toBe(1)
    // Most recently registered of the two matching registrations supplies the course context.
    expect(resolution.recipients[0]?.courseName).toBe(courseB.name)
  })

  it('always excludes cancelled registrations, even when explicitly listed by id', async () => {
    const course = await makeCourse('cancelled')
    const teacher = await makeTeacher(2)
    const registration = await makeRegistration(teacher.id, course.id, 'CANCELLED')

    const resolution = await resolveRecipients({ mode: 'ids', registrationIds: [registration.id] })
    expect(resolution.recipients).toHaveLength(0)
    expect(resolution.uniqueTeacherCount).toBe(0)
  })

  it('excludes waitlisted registrations by default, includes them only when explicitly opted in', async () => {
    const course = await makeCourse('waitlist')
    const teacher = await makeTeacher(3)
    const registration = await makeRegistration(teacher.id, course.id, 'WAITLISTED')

    const excluded = await resolveRecipients({ mode: 'ids', registrationIds: [registration.id], includeWaitlisted: false })
    expect(excluded.recipients).toHaveLength(0)

    const included = await resolveRecipients({ mode: 'ids', registrationIds: [registration.id], includeWaitlisted: true })
    expect(included.recipients).toHaveLength(1)
    expect(included.waitlistedRawCount).toBe(1)
  })

  it('a filters-mode selection never resolves a registration outside the filter, even one that exists in the database', async () => {
    const targetCourse = await makeCourse('filter-target')
    const otherCourse = await makeCourse('filter-other')
    const teacherIn = await makeTeacher(4)
    const teacherOut = await makeTeacher(5)
    const regIn = await makeRegistration(teacherIn.id, targetCourse.id, 'CONFIRMED')
    await makeRegistration(teacherOut.id, otherCourse.id, 'CONFIRMED')

    const resolution = await resolveRecipients({ mode: 'filters', filters: { courseId: targetCourse.id } })
    expect(resolution.recipients.map((r) => r.registrationId)).toEqual([regIn.id])
  })

  it('a selection spanning two courses resolves each recipient\'s course fields from their own registration, not the first course', async () => {
    const courseA = await makeCourse('multi-a')
    const courseB = await makeCourse('multi-b')
    const teacherA = await makeTeacher(6)
    const teacherB = await makeTeacher(7)
    const regA = await makeRegistration(teacherA.id, courseA.id, 'CONFIRMED')
    const regB = await makeRegistration(teacherB.id, courseB.id, 'CONFIRMED')

    const resolution = await resolveRecipients({ mode: 'ids', registrationIds: [regA.id, regB.id] })
    expect(resolution.courses.map((c) => c.id).sort()).toEqual([courseA.id, courseB.id].sort())

    const recipientA = resolution.recipients.find((r) => r.teacherId === teacherA.id)!
    const recipientB = resolution.recipients.find((r) => r.teacherId === teacherB.id)!
    expect(recipientA.courseName).toBe(courseA.name)
    expect(recipientB.courseName).toBe(courseB.name)
    expect(recipientA.courseName).not.toBe(recipientB.courseName)
  })

  it('carries a course\'s stored reminderSubject and reminderMessage through to the recipient', async () => {
    const course = await makeCourse('reminder-override', {
      reminderSubject: 'Custom subject for this course',
      reminderMessage: 'Custom body for this course',
    })
    const teacher = await makeTeacher(8)
    const registration = await makeRegistration(teacher.id, course.id, 'CONFIRMED')

    const resolution = await resolveRecipients({ mode: 'ids', registrationIds: [registration.id] })
    expect(resolution.recipients[0]?.reminderSubject).toBe('Custom subject for this course')
    expect(resolution.recipients[0]?.reminderMessage).toBe('Custom body for this course')
  })

  it('the unique teacher count always equals the resolved recipient list length', async () => {
    const course = await makeCourse('count-consistency')
    const teacher = await makeTeacher(9)
    const registration = await makeRegistration(teacher.id, course.id, 'CONFIRMED')

    const resolution = await resolveRecipients({ mode: 'ids', registrationIds: [registration.id] })
    expect(resolution.uniqueTeacherCount).toBe(resolution.recipients.length)
  })
})
