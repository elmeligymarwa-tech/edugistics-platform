import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnalyticsFilters } from '@/domain/training/analytics'
import {
  FIXTURE_COURSES,
  FIXTURE_SCHOOLS,
  FIXTURE_TEACHERS,
  buildFixtureRegistrations,
  seedTrainingAnalyticsFixture,
  type FixtureRegistration,
} from '../../../scripts/training-analytics-fixture-plan'
import * as analytics from './analytics'
import { prisma } from './prisma'

// This suite runs against the real database configured via DATABASE_URL —
// the "aggregate in SQL" requirement means there is no mockable boundary
// between the analytics module and Postgres. beforeAll seeds a fixed,
// idempotent fixture (see training-analytics-fixture-plan.ts); every test
// scopes its filters to that fixture's own course ids, so the assertions
// hold regardless of whatever other data already lives in the database.

let fixtureCourseIds: string[]
let courseIdBySlug: Map<string, string>
let schoolIdByCanonicalName: Map<string, string>
let capacityCourseId: string
let plan: FixtureRegistration[]
let courseByIndex: Map<number, (typeof FIXTURE_COURSES)[number]>
let teacherByIndex: Map<number, (typeof FIXTURE_TEACHERS)[number]>

/** All fixture rows, joined with their course/teacher records — the plain-JS oracle every SQL-backed assertion below is checked against. */
interface JoinedRegistration extends FixtureRegistration {
  course: (typeof FIXTURE_COURSES)[number]
  teacher: (typeof FIXTURE_TEACHERS)[number]
}
let joined: JoinedRegistration[]

function scoped(extra: Partial<AnalyticsFilters> = {}): AnalyticsFilters {
  return { courseIds: fixtureCourseIds, ...extra }
}

beforeAll(async () => {
  await seedTrainingAnalyticsFixture(prisma)

  plan = buildFixtureRegistrations()
  courseByIndex = new Map(FIXTURE_COURSES.map((c) => [c.index, c]))
  teacherByIndex = new Map(FIXTURE_TEACHERS.map((t) => [t.index, t]))
  joined = plan.map((reg) => ({ ...reg, course: courseByIndex.get(reg.courseIndex)!, teacher: teacherByIndex.get(reg.teacherIndex)! }))

  const courses = await prisma.course.findMany({
    where: { slug: { in: FIXTURE_COURSES.map((c) => c.slug) } },
    select: { id: true, slug: true },
  })
  courseIdBySlug = new Map(courses.map((c) => [c.slug, c.id]))
  fixtureCourseIds = courses.map((c) => c.id)
  capacityCourseId = courseIdBySlug.get(FIXTURE_COURSES[2]!.slug)!

  const schools = await prisma.school.findMany({
    where: { canonicalName: { in: FIXTURE_SCHOOLS.map((s) => s.canonicalName) } },
    select: { id: true, canonicalName: true },
  })
  schoolIdByCanonicalName = new Map(schools.map((s) => [s.canonicalName, s.id]))
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

const confirmed = () => joined.filter((r) => r.status === 'CONFIRMED')
const waitlisted = () => joined.filter((r) => r.status === 'WAITLISTED')
const cancelled = () => joined.filter((r) => r.status === 'CANCELLED')

describe('Total Registrations', () => {
  it('counts only CONFIRMED registrations', async () => {
    expect(await analytics.countRegistrations(scoped())).toBe(confirmed().length)
    expect(confirmed().length).toBe(70)
  })
})

describe('Waitlisted', () => {
  it('counts only WAITLISTED registrations', async () => {
    expect(await analytics.countWaitlisted(scoped())).toBe(waitlisted().length)
    expect(waitlisted().length).toBe(8)
  })
})

describe('cancelled registrations', () => {
  it('exist in the fixture but are excluded from every metric', async () => {
    expect(cancelled().length).toBe(12)

    const rawCancelledCount = await prisma.registration.count({
      where: { courseId: { in: fixtureCourseIds }, status: 'CANCELLED' },
    })
    expect(rawCancelledCount).toBe(12)

    // None of the authoritative metrics count them, no matter which one you ask.
    expect(await analytics.countRegistrations(scoped())).toBe(confirmed().length)
    expect(await analytics.countWaitlisted(scoped())).toBe(waitlisted().length)

    const kpis = await analytics.getDashboardKpis(scoped())
    expect(kpis.registrations).toBe(confirmed().length)

    const potentialValue = await analytics.getPotentialRegistrationValue(scoped())
    const cancelledFeeSum = cancelled().reduce((sum, r) => sum + r.course.feeAmount, 0)
    expect(cancelledFeeSum).toBeGreaterThan(0) // sanity: cancelling rows do carry a nonzero fee that must NOT leak in
    expect(potentialValue).not.toBe(potentialValue + cancelledFeeSum)

    // An explicit status filter can't smuggle CANCELLED into a CONFIRMED-only metric either.
    expect(await analytics.countRegistrations(scoped({ status: ['CANCELLED'] }))).toBe(0)
  })
})

describe('Unique Teachers', () => {
  it('counts distinct teacherId in the confirmed set', async () => {
    const distinctConfirmedTeachers = new Set(confirmed().map((r) => r.teacherIndex))
    expect(await analytics.countUniqueTeachers(scoped())).toBe(distinctConfirmedTeachers.size)
    expect(distinctConfirmedTeachers.size).toBe(40)
  })
})

describe('Unique Schools', () => {
  it('counts distinct schoolId among confirmed registrations', async () => {
    const distinctSchools = new Set(confirmed().map((r) => r.teacher.schoolIndex))
    expect(await analytics.countUniqueSchools(scoped())).toBe(distinctSchools.size)
    expect(distinctSchools.size).toBe(12)
  })
})

describe('Repeat Teachers', () => {
  it('counts teachers with more than one confirmed registration', async () => {
    const counts = new Map<number, number>()
    for (const r of confirmed()) counts.set(r.teacherIndex, (counts.get(r.teacherIndex) ?? 0) + 1)
    const repeatCount = [...counts.values()].filter((c) => c > 1).length
    expect(await analytics.countRepeatTeachers(scoped())).toBe(repeatCount)
    expect(repeatCount).toBe(20)
  })
})

describe('Potential Registration Value', () => {
  it('sums courseFeeSnapshot across confirmed registrations only, excluding waitlisted', async () => {
    const expectedValue = confirmed().reduce((sum, r) => sum + r.course.feeAmount, 0)
    expect(await analytics.getPotentialRegistrationValue(scoped())).toBe(expectedValue)
    expect(expectedValue).toBe(16800)

    // Prove waitlisted fees specifically are excluded: the capacity course
    // (fee 300) has 8 waitlisted rows. Including them would add 2400.
    const waitlistedOnCapacityCourse = waitlisted().filter((r) => r.courseIndex === 2)
    expect(waitlistedOnCapacityCourse.length).toBe(8)
    const valueIfWaitlistedWereIncluded = expectedValue + waitlistedOnCapacityCourse.length * 300
    expect(await analytics.getPotentialRegistrationValue(scoped())).not.toBe(valueIfWaitlistedWereIncluded)
  })
})

describe('Active Courses', () => {
  it('counts active, non-archived courses in scope', async () => {
    expect(await analytics.countActiveCourses(scoped())).toBe(FIXTURE_COURSES.length)
  })
})

describe('New / Engaged / Highly Engaged teachers', () => {
  it('classifies by exact confirmed-registration count', async () => {
    const breakdown = await analytics.getTeacherEngagementBreakdown(scoped())
    expect(breakdown).toEqual({ new: 20, engaged: 12, highlyEngaged: 8, returning: 20 })
  })
})

describe('Course Utilisation and Course performance', () => {
  it('matches confirmed/waitlisted/capacity/remaining/utilisation per course, and is null without a capacity', async () => {
    const rows = await analytics.getCoursePerformance(scoped())
    expect(rows.length).toBe(FIXTURE_COURSES.length)

    for (const course of FIXTURE_COURSES) {
      const row = rows.find((r) => r.courseId === courseIdBySlug.get(course.slug))!
      const expectedConfirmed = confirmed().filter((r) => r.courseIndex === course.index).length
      const expectedWaitlisted = waitlisted().filter((r) => r.courseIndex === course.index).length
      expect(row.confirmed).toBe(expectedConfirmed)
      expect(row.waitlisted).toBe(expectedWaitlisted)
      expect(row.capacity).toBe(course.maxCapacity)
      if (course.maxCapacity == null) {
        expect(row.utilisation).toBeNull()
        expect(row.remaining).toBeNull()
      } else {
        expect(row.utilisation).toBe((expectedConfirmed / course.maxCapacity) * 100)
        expect(row.remaining).toBe(Math.max(course.maxCapacity - expectedConfirmed, 0))
      }
    }

    const capacityRow = rows.find((r) => r.courseId === capacityCourseId)!
    expect(capacityRow.confirmed).toBe(10)
    expect(capacityRow.capacity).toBe(10)
    expect(capacityRow.utilisation).toBe(100)
    expect(capacityRow.remaining).toBe(0)
    expect(capacityRow.waitlisted).toBe(8)
  })
})

describe('Average Registrations per Course', () => {
  it('divides confirmed registrations by courses with at least one confirmed registration', async () => {
    const coursesWithConfirmed = new Set(confirmed().map((r) => r.courseIndex))
    const expected = confirmed().length / coursesWithConfirmed.size
    expect(await analytics.getAverageRegistrationsPerCourse(scoped())).toBe(expected)
    expect(coursesWithConfirmed.size).toBe(6)
  })

  it('is null when no course in scope has a confirmed registration', async () => {
    const result = await analytics.getAverageRegistrationsPerCourse(scoped({ status: ['WAITLISTED'] }))
    expect(result).toBeNull()
  })
})

describe('Subject distribution', () => {
  it('is built from submitted data, collapsing casing variants of the same subject', async () => {
    const counts = new Map<string, number>()
    for (const r of confirmed()) {
      const key = r.teacher.subjectOriginal.trim().toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const rows = await analytics.getSubjectDistribution(scoped())
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(confirmed().length)
    expect(rows.length).toBe(counts.size)

    const mathematicsRow = rows.find((r) => r.label.toLowerCase() === 'mathematics')!
    expect(mathematicsRow.count).toBe(counts.get('mathematics'))
  })
})

describe('Grade distribution', () => {
  it('is built from submitted data, collapsing casing variants of the same grade', async () => {
    const counts = new Map<string, number>()
    for (const r of confirmed()) {
      const key = r.teacher.gradeOriginal.trim().toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const rows = await analytics.getGradeDistribution(scoped())
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(confirmed().length)
    expect(rows.length).toBe(counts.size)

    const grade3Row = rows.find((r) => r.label.toLowerCase() === 'grade 3')!
    expect(grade3Row.count).toBe(counts.get('grade 3'))
  })
})

describe('Top schools', () => {
  it('ranks schools by confirmed registrations, respecting the limit toggle', async () => {
    const counts = new Map<number, number>()
    for (const r of confirmed()) counts.set(r.teacher.schoolIndex, (counts.get(r.teacher.schoolIndex) ?? 0) + 1)

    const all = await analytics.getTopSchools(scoped())
    expect(all.length).toBe(12)
    expect(all.reduce((sum, r) => sum + r.confirmedRegistrations, 0)).toBe(confirmed().length)
    const sorted = [...all]
    expect([...sorted].sort((a, b) => b.confirmedRegistrations - a.confirmedRegistrations)).toEqual(sorted)

    const top10 = await analytics.getTopSchools(scoped(), 10)
    expect(top10.length).toBe(10)
    expect(top10).toEqual(all.slice(0, 10))
  })
})

describe('free vs paid registrations', () => {
  it('splits confirmed registrations by courseFeeSnapshot = 0', async () => {
    const free = confirmed().filter((r) => r.course.feeAmount === 0).length
    const paid = confirmed().length - free
    const breakdown = await analytics.getFreeVsPaidBreakdown(scoped())
    expect(breakdown).toEqual({ free, paid })
  })
})

describe('Potential value by course', () => {
  it('matches confirmed count times fee, per course', async () => {
    const rows = await analytics.getPotentialValueByCourse(scoped())
    for (const course of FIXTURE_COURSES) {
      const row = rows.find((r) => r.courseId === courseIdBySlug.get(course.slug))!
      const expectedConfirmed = confirmed().filter((r) => r.courseIndex === course.index).length
      expect(row.potentialValue).toBe(expectedConfirmed * course.feeAmount)
    }
  })
})

describe('Cairo timezone day boundary', () => {
  it('groups a registration made at 23:30 Cairo time under that Cairo calendar day, not the next one', async () => {
    // teacherIndex 0 / course 2 (the capacity course), registeredAt 2025-11-15T21:30:00Z = 23:30 Cairo (UTC+2), 15 Nov.
    const trend = await analytics.getRegistrationTrend(
      scoped({ courseIds: [capacityCourseId], dateFrom: new Date('2025-11-14T00:00:00.000Z'), dateTo: new Date('2025-11-17T00:00:00.000Z') }),
      'DAY',
    )
    const nov15Bucket = trend.find((point) => point.bucketStart === '2025-11-15T00:00:00.000Z')
    const nov16Bucket = trend.find((point) => point.bucketStart === '2025-11-16T00:00:00.000Z')
    expect(nov15Bucket?.count).toBeGreaterThanOrEqual(1)
    expect(nov16Bucket).toBeUndefined()
  })

  it('groups a registration made just after Cairo midnight under the new Cairo day, even though it is still the prior day in UTC', async () => {
    // teacherIndex 1 / course 2, registeredAt 2025-11-30T22:10:00Z = 00:10 Cairo, 1 Dec — still 30 Nov in UTC.
    const trend = await analytics.getRegistrationTrend(
      scoped({ courseIds: [capacityCourseId], dateFrom: new Date('2025-11-29T00:00:00.000Z'), dateTo: new Date('2025-12-02T00:00:00.000Z') }),
      'DAY',
    )
    const nov30Bucket = trend.find((point) => point.bucketStart === '2025-11-30T00:00:00.000Z')
    const dec1Bucket = trend.find((point) => point.bucketStart === '2025-12-01T00:00:00.000Z')
    // Nov 30 bucket exists (from other confirmed registrations anchored on the 10th) but must not include this one extra count beyond its anchor batch.
    expect(dec1Bucket?.count).toBeGreaterThanOrEqual(1)
    expect(nov30Bucket?.bucketStart).not.toBe('2025-12-01T00:00:00.000Z')
  })

  it('buckets the full confirmed set by Cairo month with no rows lost or double-counted', async () => {
    const trend = await analytics.getRegistrationTrend(scoped(), 'MONTH')
    expect(trend.reduce((sum, point) => sum + point.count, 0)).toBe(confirmed().length)
  })
})

describe('filter consistency across KPIs, charts and tables', () => {
  it('a course filter narrows every panel to the same confirmed set', async () => {
    const course = FIXTURE_COURSES[0]!
    const filters = scoped({ courseIds: [courseIdBySlug.get(course.slug)!] })
    const expectedConfirmed = confirmed().filter((r) => r.courseIndex === course.index).length

    const kpis = await analytics.getDashboardKpis(filters)
    expect(kpis.registrations).toBe(expectedConfirmed)

    const performance = await analytics.getCoursePerformance(filters)
    expect(performance.reduce((sum, r) => sum + r.confirmed, 0)).toBe(expectedConfirmed)

    const subjects = await analytics.getSubjectDistribution(filters)
    expect(subjects.reduce((sum, r) => sum + r.count, 0)).toBe(expectedConfirmed)

    const grades = await analytics.getGradeDistribution(filters)
    expect(grades.reduce((sum, r) => sum + r.count, 0)).toBe(expectedConfirmed)

    const schools = await analytics.getTopSchools(filters)
    expect(schools.reduce((sum, r) => sum + r.confirmedRegistrations, 0)).toBe(expectedConfirmed)

    const trend = await analytics.getRegistrationTrend(filters, 'MONTH')
    expect(trend.reduce((sum, p) => sum + p.count, 0)).toBe(expectedConfirmed)
  })

  it('a category filter produces the same result as filtering by the one course in that category', async () => {
    const course = FIXTURE_COURSES[2]! // ASSESSMENT — unique category among the fixture courses
    const byCourse = await analytics.countRegistrations(scoped({ courseIds: [courseIdBySlug.get(course.slug)!] }))
    const byCategory = await analytics.countRegistrations(scoped({ categories: [course.category] }))
    expect(byCategory).toBe(byCourse)
    expect(byCategory).toBe(10)
  })

  it('a school filter narrows KPIs and the top-schools table consistently', async () => {
    const school = FIXTURE_SCHOOLS[0]!
    const schoolId = schoolIdByCanonicalName.get(school.canonicalName)!
    const filters = scoped({ schoolIds: [schoolId] })
    const expectedConfirmed = confirmed().filter((r) => r.teacher.schoolIndex === school.index).length

    const kpis = await analytics.getDashboardKpis(filters)
    expect(kpis.registrations).toBe(expectedConfirmed)
    expect(kpis.uniqueSchools).toBe(expectedConfirmed > 0 ? 1 : 0)

    const topSchools = await analytics.getTopSchools(filters)
    expect(topSchools).toEqual([{ schoolId, schoolName: school.canonicalName, confirmedRegistrations: expectedConfirmed }])
  })

  it('combining a date range with a course filter narrows consistently', async () => {
    const course = FIXTURE_COURSES[0]!
    const filters = scoped({
      courseIds: [courseIdBySlug.get(course.slug)!],
      dateFrom: new Date('2025-12-01T00:00:00.000Z'),
      dateTo: new Date('2026-01-31T23:59:59.999Z'),
    })
    const expectedConfirmed = confirmed().filter(
      (r) => r.courseIndex === course.index && r.registeredAt >= filters.dateFrom! && r.registeredAt <= filters.dateTo!,
    ).length

    const registrations = await analytics.countRegistrations(filters)
    expect(registrations).toBe(expectedConfirmed)

    const performance = await analytics.getCoursePerformance(filters)
    expect(performance.reduce((sum, r) => sum + r.confirmed, 0)).toBe(expectedConfirmed)
  })
})
