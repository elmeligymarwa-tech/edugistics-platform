import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { listRegistrationCourseGroups, listRegistrationsForAdmin, parseRegistrationSearchParams } from './registrations'
import { prisma } from './prisma'

describe('parseRegistrationSearchParams', () => {
  it('parses consent=true and consent=false into marketingConsent, and omits it otherwise', () => {
    expect(parseRegistrationSearchParams({ consent: 'true' }).marketingConsent).toBe(true)
    expect(parseRegistrationSearchParams({ consent: 'false' }).marketingConsent).toBe(false)
    expect(parseRegistrationSearchParams({}).marketingConsent).toBeUndefined()
    expect(parseRegistrationSearchParams({ consent: 'nonsense' }).marketingConsent).toBeUndefined()
  })
})

// Self-contained and uniquely marked — unlike the shared analytics fixture,
// this suite tears down everything it creates in afterAll.
const MARKER = 'regs-course-group-test'

let courseAId: string
let courseBId: string
let courseCId: string
let teacherIds: string[] = []

beforeAll(async () => {
  const school = await prisma.school.create({
    data: { canonicalName: `${MARKER} School`, nameKey: `${MARKER}-school` },
  })

  const courseDefaults = {
    shortDescription: 'x',
    fullDescription: 'x',
    startTime: new Date('1970-01-01T09:00:00.000Z'),
    endTime: new Date('1970-01-01T10:00:00.000Z'),
    durationMinutes: 60,
    deliveryMethod: 'ONLINE' as const,
  }

  const [courseA, courseB, courseC] = await Promise.all([
    prisma.course.create({
      data: {
        ...courseDefaults,
        name: `${MARKER} Course A`,
        slug: `${MARKER}-course-a`,
        category: 'LEADERSHIP',
        courseDate: new Date('2026-01-10T00:00:00.000Z'),
        maxCapacity: 5,
      },
    }),
    prisma.course.create({
      data: {
        ...courseDefaults,
        name: `${MARKER} Course B`,
        slug: `${MARKER}-course-b`,
        category: 'ASSESSMENT',
        courseDate: new Date('2026-02-10T00:00:00.000Z'),
      },
    }),
    prisma.course.create({
      data: {
        ...courseDefaults,
        name: `${MARKER} Course C (no registrations)`,
        slug: `${MARKER}-course-c`,
        category: 'CURRICULUM',
        courseDate: new Date('2026-03-10T00:00:00.000Z'),
      },
    }),
  ])
  courseAId = courseA.id
  courseBId = courseB.id
  courseCId = courseC.id

  const teachers = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      prisma.teacher.create({
        data: {
          emailNormalised: `${MARKER}-teacher-${i}@test.local`,
          emailOriginal: `${MARKER}-teacher-${i}@test.local`,
          fullName: `${MARKER} Teacher ${i}`,
          phone: `+2010${i}`,
          phoneNormalised: `+2010${i}`,
          schoolId: school.id,
          schoolNameOriginal: school.canonicalName,
          subjectOriginal: 'Mathematics',
          subjectNormalised: 'mathematics',
          gradeOriginal: 'Grade 3',
          gradeNormalised: 'grade 3',
          marketingConsent: i === 0,
          marketingConsentAt: i === 0 ? new Date() : null,
          firstRegisteredAt: new Date(),
          lastRegisteredAt: new Date(),
        },
      }),
    ),
  )
  teacherIds = teachers.map((t) => t.id)

  await prisma.registration.createMany({
    data: [
      {
        reference: `${MARKER}-1`,
        teacherId: teacherIds[0]!,
        courseId: courseAId,
        courseNameSnapshot: courseA.name,
        courseDateSnapshot: courseA.courseDate,
        courseFeeSnapshot: 0,
        courseCurrencySnapshot: 'EGP',
        status: 'CONFIRMED',
        emailType: 'CONFIRMED',
      },
      {
        reference: `${MARKER}-2`,
        teacherId: teacherIds[1]!,
        courseId: courseAId,
        courseNameSnapshot: courseA.name,
        courseDateSnapshot: courseA.courseDate,
        courseFeeSnapshot: 0,
        courseCurrencySnapshot: 'EGP',
        status: 'WAITLISTED',
        emailType: 'WAITLISTED',
      },
      {
        reference: `${MARKER}-3`,
        teacherId: teacherIds[2]!,
        courseId: courseBId,
        courseNameSnapshot: courseB.name,
        courseDateSnapshot: courseB.courseDate,
        courseFeeSnapshot: 0,
        courseCurrencySnapshot: 'EGP',
        status: 'CONFIRMED',
        emailType: 'CONFIRMED',
      },
      {
        reference: `${MARKER}-4`,
        teacherId: teacherIds[3]!,
        courseId: courseBId,
        courseNameSnapshot: courseB.name,
        courseDateSnapshot: courseB.courseDate,
        courseFeeSnapshot: 0,
        courseCurrencySnapshot: 'EGP',
        status: 'CANCELLED',
        emailType: 'CONFIRMED',
        cancelledAt: new Date(),
      },
    ],
  })
}, 30_000)

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { reference: { startsWith: MARKER } } })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { startsWith: MARKER } } })
  await prisma.course.deleteMany({ where: { slug: { startsWith: MARKER } } })
  await prisma.school.deleteMany({ where: { nameKey: `${MARKER}-school` } })
  await prisma.$disconnect()
})

describe('listRegistrationCourseGroups', () => {
  it('includes only courses with at least one matching registration, ordered by course date descending', async () => {
    const groups = await listRegistrationCourseGroups({})
    const ids = groups.map((g) => g.courseId)

    expect(ids).not.toContain(courseCId)
    const indexA = ids.indexOf(courseAId)
    const indexB = ids.indexOf(courseBId)
    expect(indexA).toBeGreaterThan(-1)
    expect(indexB).toBeGreaterThan(-1)
    expect(indexB).toBeLessThan(indexA) // Course B (Feb) sorts before Course A (Jan) — descending
  })

  it('reports confirmed/waitlisted counts and capacity, ignoring cancelled rows', async () => {
    const groups = await listRegistrationCourseGroups({})

    const groupA = groups.find((g) => g.courseId === courseAId)!
    expect(groupA.confirmedCount).toBe(1)
    expect(groupA.waitlistedCount).toBe(1)
    expect(groupA.capacity).toBe(5)

    const groupB = groups.find((g) => g.courseId === courseBId)!
    expect(groupB.confirmedCount).toBe(1)
    expect(groupB.waitlistedCount).toBe(0)
    expect(groupB.capacity).toBeNull()
  })

  it('narrows the course list to only courses matching an applied filter', async () => {
    // Asserts by inclusion/exclusion rather than exact equality — other
    // fixtures (e.g. the analytics suite) may leave their own waitlisted
    // registrations in a shared dev database.
    const groups = await listRegistrationCourseGroups({ status: 'WAITLISTED' })
    const ids = groups.map((g) => g.courseId)
    expect(ids).toContain(courseAId)
    expect(ids).not.toContain(courseBId)
    expect(ids).not.toContain(courseCId)
  })
})

describe('listRegistrationsForAdmin scoped to one course', () => {
  it('returns only that course rows for per-section pagination', async () => {
    const { rows, totalCount } = await listRegistrationsForAdmin({ courseId: courseAId }, 0)
    expect(totalCount).toBe(2)
    expect(rows.every((r) => r.courseId === courseAId)).toBe(true)
  })

  it('filters to only registrations whose teacher has given marketing consent', async () => {
    const { rows } = await listRegistrationsForAdmin({ courseId: courseAId, marketingConsent: true }, 0)
    expect(rows.every((r) => r.marketingConsent === true)).toBe(true)
    expect(rows.map((r) => r.reference)).toContain(`${MARKER}-1`)
    expect(rows.map((r) => r.reference)).not.toContain(`${MARKER}-2`)
  })

  it('filters to only registrations whose teacher has not consented', async () => {
    const { rows } = await listRegistrationsForAdmin({ courseId: courseAId, marketingConsent: false }, 0)
    expect(rows.every((r) => r.marketingConsent === false)).toBe(true)
    expect(rows.map((r) => r.reference)).toContain(`${MARKER}-2`)
    expect(rows.map((r) => r.reference)).not.toContain(`${MARKER}-1`)
  })
})
