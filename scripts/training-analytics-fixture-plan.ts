// Deterministic Phase 4 analytics fixture — shared between the seed script
// (scripts/seed-training-analytics-fixture.mts, which writes it to Postgres)
// and the analytics test suite (src/lib/training/analytics.test.ts, which
// re-derives "expected" numbers from this same plan in plain JS and asserts
// the SQL-backed analytics module agrees). Every marker (course slug prefix,
// teacher email domain, school name prefix) is unique to this fixture so it
// can be seeded into and queried out of a shared dev database without
// touching real data.
import type { PrismaClient } from '@prisma/client'

import { normaliseSchoolNameKey } from '../src/lib/training/normalise.ts'

export const FIXTURE_MARKER = 'phase4-fixture'
export const FIXTURE_TEACHER_EMAIL_DOMAIN = 'phase4-fixture.test'

export type FixtureCategory =
  | 'LEADERSHIP'
  | 'TEACHING_LEARNING'
  | 'ASSESSMENT'
  | 'CURRICULUM'
  | 'SEN'
  | 'TECHNOLOGY'

export interface FixtureCourse {
  index: number
  slug: string
  name: string
  category: FixtureCategory
  feeAmount: number
  maxCapacity: number | null
  waitlistEnabled: boolean
  waitlistCapacity: number | null
}

/** Course 2 (Assessment) is the "one at capacity with a waitlist" course: exactly 10 confirmed (= maxCapacity) and 8 waitlisted (= waitlistCapacity), both full. */
export const FIXTURE_COURSES: FixtureCourse[] = [
  {
    index: 0,
    slug: `${FIXTURE_MARKER}-leadership`,
    name: 'Fixture Leadership Essentials',
    category: 'LEADERSHIP',
    feeAmount: 500,
    maxCapacity: null,
    waitlistEnabled: false,
    waitlistCapacity: null,
  },
  {
    index: 1,
    slug: `${FIXTURE_MARKER}-teaching-learning`,
    name: 'Fixture Teaching & Learning Lab',
    category: 'TEACHING_LEARNING',
    feeAmount: 0,
    maxCapacity: null,
    waitlistEnabled: false,
    waitlistCapacity: null,
  },
  {
    index: 2,
    slug: `${FIXTURE_MARKER}-assessment`,
    name: 'Fixture Assessment Design',
    category: 'ASSESSMENT',
    feeAmount: 300,
    maxCapacity: 10,
    waitlistEnabled: true,
    waitlistCapacity: 8,
  },
  {
    index: 3,
    slug: `${FIXTURE_MARKER}-curriculum`,
    name: 'Fixture Curriculum Mapping',
    category: 'CURRICULUM',
    feeAmount: 250,
    maxCapacity: null,
    waitlistEnabled: false,
    waitlistCapacity: null,
  },
  {
    index: 4,
    slug: `${FIXTURE_MARKER}-sen`,
    name: 'Fixture SEN Strategies',
    category: 'SEN',
    feeAmount: 0,
    maxCapacity: null,
    waitlistEnabled: false,
    waitlistCapacity: null,
  },
  {
    index: 5,
    slug: `${FIXTURE_MARKER}-technology`,
    name: 'Fixture Classroom Tech',
    category: 'TECHNOLOGY',
    feeAmount: 400,
    maxCapacity: null,
    waitlistEnabled: false,
    waitlistCapacity: null,
  },
]

export interface FixtureSchool {
  index: number
  canonicalName: string
}

/** 12 schools; #9 ("Nasr City Languages School") is an obvious human-readable variant of #6 ("Nasr City Language School") that does NOT collapse under normaliseSchoolNameKey — realistic messy data a real admin would need to merge manually, per school-matching.ts's "no fuzzy matching" rule. */
export const FIXTURE_SCHOOLS: FixtureSchool[] = [
  { index: 0, canonicalName: 'Phase4 Fixture Nile British School' },
  { index: 1, canonicalName: 'Phase4 Fixture Cairo American College' },
  { index: 2, canonicalName: 'Phase4 Fixture Maadi International School' },
  { index: 3, canonicalName: 'Phase4 Fixture New Cairo British School' },
  { index: 4, canonicalName: 'Phase4 Fixture Heliopolis Language School' },
  { index: 5, canonicalName: 'Phase4 Fixture Zamalek STEM School' },
  { index: 6, canonicalName: 'Phase4 Fixture Nasr City Language School' },
  { index: 7, canonicalName: 'Phase4 Fixture Giza National School' },
  { index: 8, canonicalName: 'Phase4 Fixture Sixth of October British School' },
  { index: 9, canonicalName: 'Phase4 Fixture Nasr City Languages School' },
  { index: 10, canonicalName: 'Phase4 Fixture Alexandria International Academy' },
  { index: 11, canonicalName: 'Phase4 Fixture 6 October STEM Academy' },
]

const SUBJECTS = ['Mathematics', 'mathematics', 'English', 'Science', 'Art', 'ICT']
const GRADES = ['Grade 3', 'grade 3', 'Grade 6', 'Grade 9', 'Grade 11']

export interface FixtureTeacher {
  index: number
  email: string
  fullName: string
  schoolIndex: number
  subjectOriginal: string
  gradeOriginal: string
  marketingConsent: boolean
}

const TEACHER_COUNT = 40

export const FIXTURE_TEACHERS: FixtureTeacher[] = Array.from({ length: TEACHER_COUNT }, (_, index) => ({
  index,
  email: `${FIXTURE_MARKER}-teacher-${String(index + 1).padStart(2, '0')}@${FIXTURE_TEACHER_EMAIL_DOMAIN}`,
  fullName: `Fixture Teacher ${index + 1}`,
  schoolIndex: index % FIXTURE_SCHOOLS.length,
  subjectOriginal: SUBJECTS[index % SUBJECTS.length]!,
  gradeOriginal: GRADES[index % GRADES.length]!,
  marketingConsent: index % 3 === 0,
}))

export type FixtureRegistrationStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'

export interface FixtureRegistration {
  teacherIndex: number
  courseIndex: number
  status: FixtureRegistrationStatus
  registeredAt: Date
}

const CAPACITY_COURSE = 2
const OTHER_COURSES = [0, 1, 3, 4, 5]
const OTHER_COURSE_TARGET = 12

/** Anchors spread across four calendar months (Nov 2025 - Feb 2026), each registration offset by a few minutes so timestamps within a month are distinct but never cross a month boundary by construction. */
const MONTH_ANCHORS = [
  Date.UTC(2025, 10, 10, 9, 0, 0), // November 2025
  Date.UTC(2025, 11, 10, 9, 0, 0), // December 2025
  Date.UTC(2026, 0, 10, 9, 0, 0), // January 2026
  Date.UTC(2026, 1, 10, 9, 0, 0), // February 2026
]

function anchoredTimestamp(sequence: number): Date {
  const anchor = MONTH_ANCHORS[sequence % MONTH_ANCHORS.length]!
  return new Date(anchor + sequence * 3 * 60_000)
}

/**
 * Builds the full 90-row registration set: 70 confirmed (20 teachers with
 * exactly 1, 12 with exactly 2, 6 with exactly 3, 2 with exactly 4 — giving
 * clean New/Engaged/Highly-engaged buckets of 20/12/8), 8 waitlisted (all on
 * the capacity course, filling its waitlist exactly), and 12 cancelled
 * (spread across otherwise-unused teacher/course pairs, to prove
 * cancellations never move a metric).
 */
export function buildFixtureRegistrations(): FixtureRegistration[] {
  const usedPairs = new Set<string>()
  const pairKey = (teacherIndex: number, courseIndex: number) => `${teacherIndex}-${courseIndex}`

  function claim(teacherIndex: number, courseIndex: number): void {
    const key = pairKey(teacherIndex, courseIndex)
    if (usedPairs.has(key)) throw new Error(`Fixture plan collision: teacher ${teacherIndex} / course ${courseIndex}`)
    usedPairs.add(key)
  }

  const confirmedPairs: { teacherIndex: number; courseIndex: number }[] = []

  // Capacity course: teachers 0-9, one confirmed registration each.
  for (let teacherIndex = 0; teacherIndex <= 9; teacherIndex++) {
    claim(teacherIndex, CAPACITY_COURSE)
    confirmedPairs.push({ teacherIndex, courseIndex: CAPACITY_COURSE })
  }

  // Remaining confirmed demand, spread across the five non-capacity courses at 12 each.
  const demand = new Map<number, number>()
  for (let t = 10; t <= 19; t++) demand.set(t, 1) // New (remainder of the New bucket)
  for (let t = 20; t <= 31; t++) demand.set(t, 2) // Engaged
  for (let t = 32; t <= 37; t++) demand.set(t, 3) // Highly engaged (3)
  for (let t = 38; t <= 39; t++) demand.set(t, 4) // Highly engaged (4)

  const filledPerCourse = new Map(OTHER_COURSES.map((course) => [course, 0]))
  let courseCursor = 0
  for (const [teacherIndex, count] of demand) {
    for (let i = 0; i < count; i++) {
      let placed = false
      for (let attempt = 0; attempt < OTHER_COURSES.length * 2 && !placed; attempt++) {
        const courseIndex = OTHER_COURSES[courseCursor % OTHER_COURSES.length]!
        courseCursor++
        const key = pairKey(teacherIndex, courseIndex)
        if ((filledPerCourse.get(courseIndex) ?? 0) < OTHER_COURSE_TARGET && !usedPairs.has(key)) {
          claim(teacherIndex, courseIndex)
          confirmedPairs.push({ teacherIndex, courseIndex })
          filledPerCourse.set(courseIndex, (filledPerCourse.get(courseIndex) ?? 0) + 1)
          placed = true
        }
      }
      if (!placed) throw new Error(`Could not place a confirmed fixture registration for teacher ${teacherIndex}`)
    }
  }
  for (const course of OTHER_COURSES) {
    if (filledPerCourse.get(course) !== OTHER_COURSE_TARGET) throw new Error(`Course ${course} did not reach its fixture target`)
  }

  // Waitlisted: 8 registrations on the capacity course, teachers 10-17 (none of whom have touched that course yet).
  const waitlistedPairs: { teacherIndex: number; courseIndex: number }[] = []
  for (let teacherIndex = 10; teacherIndex <= 17; teacherIndex++) {
    claim(teacherIndex, CAPACITY_COURSE)
    waitlistedPairs.push({ teacherIndex, courseIndex: CAPACITY_COURSE })
  }

  // Cancelled: 12 registrations on the first still-unused course for teachers 18-29.
  const cancelledPairs: { teacherIndex: number; courseIndex: number }[] = []
  for (let teacherIndex = 18; teacherIndex <= 29; teacherIndex++) {
    const courseIndex = FIXTURE_COURSES.map((c) => c.index).find((candidate) => !usedPairs.has(pairKey(teacherIndex, candidate)))
    if (courseIndex === undefined) throw new Error(`No free course left to cancel for teacher ${teacherIndex}`)
    claim(teacherIndex, courseIndex)
    cancelledPairs.push({ teacherIndex, courseIndex })
  }

  let sequence = 0
  const registrations: FixtureRegistration[] = []
  const nextTimestamp = (): Date => {
    // The two Cairo day-boundary probes: index 0 sits at 23:30 Cairo local
    // time (still that Cairo day); index 1 sits ten minutes after Cairo
    // midnight (already the next Cairo day, while still the same UTC day).
    if (sequence === 0) {
      sequence++
      return new Date('2025-11-15T21:30:00.000Z') // 23:30 Cairo (UTC+2), 15 Nov
    }
    if (sequence === 1) {
      sequence++
      return new Date('2025-11-30T22:10:00.000Z') // 00:10 Cairo, 1 Dec — still 30 Nov in UTC
    }
    return anchoredTimestamp(sequence++)
  }

  for (const pair of confirmedPairs) {
    registrations.push({ ...pair, status: 'CONFIRMED', registeredAt: nextTimestamp() })
  }
  for (const pair of waitlistedPairs) {
    registrations.push({ ...pair, status: 'WAITLISTED', registeredAt: nextTimestamp() })
  }
  for (const pair of cancelledPairs) {
    registrations.push({ ...pair, status: 'CANCELLED', registeredAt: nextTimestamp() })
  }

  return registrations
}

/**
 * Deletes every row this fixture owns, matched purely by its own markers
 * (course slug prefix, teacher email domain, school name prefix) so it's
 * safe to run against a shared database without touching real data. Shared
 * by seedTrainingAnalyticsFixture (which runs this first, so a re-seed is
 * idempotent) and by the analytics test suite's own afterAll (which runs
 * this last, so the fixture never outlives the test run that created it —
 * these six "Fixture ..." courses are isActive:true and therefore publicly
 * visible on /training the moment they exist).
 */
export async function deleteTrainingAnalyticsFixture(prisma: PrismaClient): Promise<void> {
  const existingCourses = await prisma.course.findMany({
    where: { slug: { startsWith: FIXTURE_MARKER } },
    select: { id: true },
  })
  await prisma.registration.deleteMany({
    where: {
      OR: [
        { courseId: { in: existingCourses.map((c) => c.id) } },
        { teacher: { emailNormalised: { endsWith: `@${FIXTURE_TEACHER_EMAIL_DOMAIN}` } } },
      ],
    },
  })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { endsWith: `@${FIXTURE_TEACHER_EMAIL_DOMAIN}` } } })
  await prisma.course.deleteMany({ where: { slug: { startsWith: FIXTURE_MARKER } } })
  await prisma.school.deleteMany({ where: { canonicalName: { startsWith: 'Phase4 Fixture' } } })
}

/**
 * Writes the fixture to the database: deletes any prior run of this fixture
 * (matched purely by its markers, so it's safe against a shared dev
 * database), then recreates schools, courses, teachers and registrations.
 * Returns the registration count written. Callers look the created rows up
 * afterwards via their deterministic slugs/emails/names — no id handoff
 * needed.
 */
export async function seedTrainingAnalyticsFixture(prisma: PrismaClient): Promise<number> {
  await deleteTrainingAnalyticsFixture(prisma)

  // Batched inserts throughout — this fixture writes ~150 rows, and one
  // create() per row over a pooled remote connection is what previously
  // blew past vitest's beforeAll timeout. createManyAndReturn still gives
  // back the generated ids in one round trip; createMany needs none.
  const createdSchools = await prisma.school.createManyAndReturn({
    data: FIXTURE_SCHOOLS.map((school) => ({
      canonicalName: school.canonicalName,
      nameKey: normaliseSchoolNameKey(school.canonicalName),
    })),
  })
  const schoolIdByNameKey = new Map(createdSchools.map((s) => [s.nameKey, s.id]))
  const schoolIdByIndex = new Map(
    FIXTURE_SCHOOLS.map((school) => [school.index, schoolIdByNameKey.get(normaliseSchoolNameKey(school.canonicalName))!]),
  )

  const createdCourses = await prisma.course.createManyAndReturn({
    data: FIXTURE_COURSES.map((course) => ({
      name: course.name,
      slug: course.slug,
      shortDescription: `${course.name} — Phase 4 fixture data.`,
      fullDescription: `${course.name} — Phase 4 analytics fixture course. Not a real course.`,
      category: course.category,
      courseDate: new Date('2026-04-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T12:00:00.000Z'),
      durationMinutes: 180,
      deliveryMethod: 'ONLINE',
      feeAmount: course.feeAmount,
      currency: 'EGP',
      maxCapacity: course.maxCapacity,
      waitlistEnabled: course.waitlistEnabled,
      waitlistCapacity: course.waitlistCapacity,
      isActive: true,
      isFeatured: false,
    })),
  })
  const courseIdBySlug = new Map(createdCourses.map((c) => [c.slug, c.id]))
  const courseIdByIndex = new Map(FIXTURE_COURSES.map((course) => [course.index, courseIdBySlug.get(course.slug)!]))
  const courseByIndex = new Map(FIXTURE_COURSES.map((c) => [c.index, c]))

  const registrations = buildFixtureRegistrations()

  const timestampsByTeacher = new Map<number, Date[]>()
  for (const reg of registrations) {
    const list = timestampsByTeacher.get(reg.teacherIndex) ?? []
    list.push(reg.registeredAt)
    timestampsByTeacher.set(reg.teacherIndex, list)
  }

  const createdTeachers = await prisma.teacher.createManyAndReturn({
    data: FIXTURE_TEACHERS.map((teacher) => {
      const timestamps = (timestampsByTeacher.get(teacher.index) ?? []).sort((a, b) => a.getTime() - b.getTime())
      return {
        emailNormalised: teacher.email,
        emailOriginal: teacher.email,
        fullName: teacher.fullName,
        phone: `+2010${String(teacher.index).padStart(8, '0')}`,
        phoneNormalised: `+2010${String(teacher.index).padStart(8, '0')}`,
        address: 'Phase 4 fixture address',
        schoolId: schoolIdByIndex.get(teacher.schoolIndex)!,
        schoolNameOriginal: FIXTURE_SCHOOLS[teacher.schoolIndex]!.canonicalName,
        subjectOriginal: teacher.subjectOriginal,
        subjectNormalised: teacher.subjectOriginal.trim().toLowerCase(),
        gradeOriginal: teacher.gradeOriginal,
        gradeNormalised: teacher.gradeOriginal.trim().toLowerCase(),
        marketingConsent: teacher.marketingConsent,
        marketingConsentAt: teacher.marketingConsent ? (timestamps[0] ?? null) : null,
        firstRegisteredAt: timestamps[0] ?? new Date(),
        lastRegisteredAt: timestamps[timestamps.length - 1] ?? new Date(),
      }
    }),
  })
  const teacherIdByEmail = new Map(createdTeachers.map((t) => [t.emailNormalised, t.id]))
  const teacherIdByIndex = new Map(FIXTURE_TEACHERS.map((teacher) => [teacher.index, teacherIdByEmail.get(teacher.email)!]))

  let waitlistCounter = 0
  await prisma.registration.createMany({
    data: registrations.map((reg) => {
      const course = courseByIndex.get(reg.courseIndex)!
      const teacher = FIXTURE_TEACHERS[reg.teacherIndex]!
      const waitlistPosition = reg.status === 'WAITLISTED' ? ++waitlistCounter : null
      return {
        reference: `EDU-FIXTURE-${reg.teacherIndex}-${reg.courseIndex}`,
        teacherId: teacherIdByIndex.get(reg.teacherIndex)!,
        courseId: courseIdByIndex.get(reg.courseIndex)!,
        courseNameSnapshot: course.name,
        courseDateSnapshot: new Date('2026-04-01T00:00:00.000Z'),
        courseFeeSnapshot: course.feeAmount,
        courseCurrencySnapshot: 'EGP',
        status: reg.status,
        waitlistPosition,
        registeredAt: reg.registeredAt,
        consentGiven: teacher.marketingConsent,
        consentAt: teacher.marketingConsent ? reg.registeredAt : null,
        emailSent: true,
        emailSentAt: reg.registeredAt,
        emailStatus: 'SENT' as const,
        emailType: reg.status === 'WAITLISTED' ? ('WAITLISTED' as const) : ('CONFIRMED' as const),
        cancelledAt: reg.status === 'CANCELLED' ? new Date(reg.registeredAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
      }
    }),
  })

  return registrations.length
}
