import 'server-only'

import { Prisma, type CourseCategory as PrismaCourseCategory, type RegistrationStatus } from '@prisma/client'

import { COURSE_CATEGORY_LABELS, type CourseCategory } from '@/domain/training/schema'
import type { AnalyticsFilters, RegistrationStatusFilter, TeacherEngagementType, TrendGranularity } from '@/domain/training/analytics'
import { TEACHER_ENGAGEMENT_LABELS } from '@/domain/training/analytics'
import { prisma } from './prisma'

/**
 * registeredAt is stored as a naive TIMESTAMP(3) — no zone attached — but
 * every value written into it is a UTC instant (Prisma/pg serialise a JS
 * Date to that column type using its UTC clock fields). Bucketing by Cairo
 * calendar day therefore needs two conversions: first read the naive value
 * back as the UTC instant it actually is, then re-express that instant in
 * Cairo wall-clock time before truncating. Applying `AT TIME ZONE 'Africa/Cairo'`
 * directly to the naive column — skipping the UTC step — silently shifts
 * every bucket by the Cairo offset and groups in the wrong day.
 */
const CAIRO_LOCAL_INSTANT_SQL = Prisma.sql`(r."registeredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')`

function effectiveStatuses(filters: AnalyticsFilters, allowed: RegistrationStatusFilter[]): RegistrationStatusFilter[] {
  if (!filters.status || filters.status.length === 0) return allowed
  return allowed.filter((status) => filters.status!.includes(status))
}

function classifyEngagement(confirmedCount: number): TeacherEngagementType | null {
  if (confirmedCount === 1) return 'NEW'
  if (confirmedCount === 2) return 'ENGAGED'
  if (confirmedCount >= 3) return 'HIGHLY_ENGAGED'
  return null
}

/** One row per distinct teacherId — a GROUP BY COUNT(*), not raw registration rows — so this stays cheap at several thousand registrations. The single source every engagement metric (unique/repeat teacher counts, the engagement breakdown, and the teacherType filter) reads from. */
async function confirmedCountsByTeacher(filters: AnalyticsFilters): Promise<Map<string, number>> {
  const where = await buildWhere({ ...filters, teacherType: undefined }, ['CONFIRMED'])
  const rows = await prisma.registration.groupBy({ by: ['teacherId'], where, _count: { _all: true } })
  return new Map(rows.map((row) => [row.teacherId, row._count._all]))
}

async function resolveTeacherIdsForEngagement(filters: AnalyticsFilters, buckets: TeacherEngagementType[]): Promise<string[]> {
  const counts = await confirmedCountsByTeacher(filters)
  const ids: string[] = []
  for (const [teacherId, count] of counts) {
    const bucket = classifyEngagement(count)
    if (bucket && buckets.includes(bucket)) ids.push(teacherId)
  }
  return ids
}

/** Typed Prisma where-clause, shared by every count/sum/groupBy query that doesn't need Cairo-aware date bucketing. Relation filters here (course.category, teacher.*) still compile to a single SQL query with joins/subqueries — Prisma never materialises the relation client-side. */
async function buildWhere(filters: AnalyticsFilters, allowedStatuses: RegistrationStatusFilter[]): Promise<Prisma.RegistrationWhereInput> {
  const statuses = effectiveStatuses(filters, allowedStatuses)
  const where: Prisma.RegistrationWhereInput = { status: { in: statuses as RegistrationStatus[] } }

  if (filters.dateFrom || filters.dateTo) {
    where.registeredAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }
  if (filters.courseIds?.length) where.courseId = { in: filters.courseIds }
  if (filters.categories?.length) where.course = { category: { in: filters.categories as PrismaCourseCategory[] } }

  const teacherWhere: Prisma.TeacherWhereInput = {}
  if (filters.schoolIds?.length) teacherWhere.schoolId = { in: filters.schoolIds }
  if (filters.subjects?.length) teacherWhere.subjectNormalised = { in: filters.subjects }
  if (filters.grades?.length) teacherWhere.gradeNormalised = { in: filters.grades }
  if (filters.marketingConsent !== undefined) teacherWhere.marketingConsent = filters.marketingConsent
  if (filters.teacherType?.length) {
    const ids = await resolveTeacherIdsForEngagement(filters, filters.teacherType)
    teacherWhere.id = { in: ids }
  }
  if (Object.keys(teacherWhere).length > 0) where.teacher = teacherWhere

  return where
}

/** Raw-SQL equivalent of {@link buildWhere}, for the handful of metrics that need a JOIN the typed Prisma API can't express (grouping by a Teacher/School column) or Cairo-aware date truncation. Aliases: r = Registration, t = Teacher, c = Course. */
async function buildWhereSql(filters: AnalyticsFilters, allowedStatuses: RegistrationStatusFilter[]): Promise<Prisma.Sql> {
  const statuses = effectiveStatuses(filters, allowedStatuses)
  const conditions: Prisma.Sql[] = [
    statuses.length > 0 ? Prisma.sql`r."status"::text IN (${Prisma.join(statuses)})` : Prisma.sql`FALSE`,
  ]

  if (filters.dateFrom) conditions.push(Prisma.sql`r."registeredAt" >= ${filters.dateFrom}`)
  if (filters.dateTo) conditions.push(Prisma.sql`r."registeredAt" <= ${filters.dateTo}`)
  if (filters.courseIds?.length) conditions.push(Prisma.sql`r."courseId" IN (${Prisma.join(filters.courseIds)})`)
  if (filters.categories?.length) conditions.push(Prisma.sql`c."category"::text IN (${Prisma.join(filters.categories)})`)
  if (filters.schoolIds?.length) conditions.push(Prisma.sql`t."schoolId" IN (${Prisma.join(filters.schoolIds)})`)
  if (filters.subjects?.length) conditions.push(Prisma.sql`t."subjectNormalised" IN (${Prisma.join(filters.subjects)})`)
  if (filters.grades?.length) conditions.push(Prisma.sql`t."gradeNormalised" IN (${Prisma.join(filters.grades)})`)
  if (filters.marketingConsent !== undefined) conditions.push(Prisma.sql`t."marketingConsent" = ${filters.marketingConsent}`)
  if (filters.teacherType?.length) {
    const ids = await resolveTeacherIdsForEngagement(filters, filters.teacherType)
    conditions.push(ids.length > 0 ? Prisma.sql`r."teacherId" IN (${Prisma.join(ids)})` : Prisma.sql`FALSE`)
  }

  return Prisma.join(conditions, ' AND ')
}

const FROM_JOIN_SQL = Prisma.sql`
  FROM "Registration" r
  JOIN "Teacher" t ON t."id" = r."teacherId"
  JOIN "Course" c ON c."id" = r."courseId"
`

// ---------------------------------------------------------------------------
// Authoritative definitions
// ---------------------------------------------------------------------------

/** Total Registrations = count where status is CONFIRMED. */
export async function countRegistrations(filters: AnalyticsFilters): Promise<number> {
  const where = await buildWhere(filters, ['CONFIRMED'])
  return prisma.registration.count({ where })
}

/** Waitlisted = count where status is WAITLISTED. */
export async function countWaitlisted(filters: AnalyticsFilters): Promise<number> {
  const where = await buildWhere(filters, ['WAITLISTED'])
  return prisma.registration.count({ where })
}

/** Unique Teachers = count of distinct teacherId in the confirmed set. */
export async function countUniqueTeachers(filters: AnalyticsFilters): Promise<number> {
  const counts = await confirmedCountsByTeacher(filters)
  return counts.size
}

/** Repeat Teachers = teachers with more than one confirmed registration. */
export async function countRepeatTeachers(filters: AnalyticsFilters): Promise<number> {
  const counts = await confirmedCountsByTeacher(filters)
  let repeat = 0
  for (const count of counts.values()) if (count > 1) repeat++
  return repeat
}

/** Unique Schools = count of distinct schoolId in the confirmed set. */
export async function countUniqueSchools(filters: AnalyticsFilters): Promise<number> {
  const whereSql = await buildWhereSql(filters, ['CONFIRMED'])
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT t."schoolId")::bigint AS "count"
    ${FROM_JOIN_SQL}
    WHERE ${whereSql} AND t."schoolId" IS NOT NULL
  `)
  return Number(rows[0]?.count ?? 0)
}

/** Active Courses = Course.isActive courses (not archived), scoped to any course-level filters in play. */
export async function countActiveCourses(filters: AnalyticsFilters): Promise<number> {
  const where: Prisma.CourseWhereInput = { isActive: true, archivedAt: null }
  if (filters.courseIds?.length) where.id = { in: filters.courseIds }
  if (filters.categories?.length) where.category = { in: filters.categories as PrismaCourseCategory[] }
  return prisma.course.count({ where })
}

/** Potential Registration Value = sum of courseFeeSnapshot across confirmed registrations only. */
export async function getPotentialRegistrationValue(filters: AnalyticsFilters): Promise<number> {
  const where = await buildWhere(filters, ['CONFIRMED'])
  const result = await prisma.registration.aggregate({ where, _sum: { courseFeeSnapshot: true } })
  return Number(result._sum.courseFeeSnapshot ?? 0)
}

export interface DashboardKpis {
  registrations: number
  uniqueTeachers: number
  uniqueSchools: number
  activeCourses: number
  repeatTeachers: number
  potentialValue: number
}

export async function getDashboardKpis(filters: AnalyticsFilters): Promise<DashboardKpis> {
  const [registrations, uniqueTeachers, uniqueSchools, activeCourses, repeatTeachers, potentialValue] = await Promise.all([
    countRegistrations(filters),
    countUniqueTeachers(filters),
    countUniqueSchools(filters),
    countActiveCourses(filters),
    countRepeatTeachers(filters),
    getPotentialRegistrationValue(filters),
  ])
  return { registrations, uniqueTeachers, uniqueSchools, activeCourses, repeatTeachers, potentialValue }
}

export interface CoursePerformanceRow {
  courseId: string
  courseName: string
  category: CourseCategory
  confirmed: number
  waitlisted: number
  capacity: number | null
  remaining: number | null
  utilisation: number | null
}

/** Course performance table — one row per course with at least one confirmed or waitlisted registration in the filtered scope. Course Utilisation = confirmed / maxCapacity * 100, null when maxCapacity is null. */
export async function getCoursePerformance(filters: AnalyticsFilters): Promise<CoursePerformanceRow[]> {
  const where = await buildWhere(filters, ['CONFIRMED', 'WAITLISTED'])
  const grouped = await prisma.registration.groupBy({ by: ['courseId', 'status'], where, _count: { _all: true } })
  if (grouped.length === 0) return []

  const courseIds = [...new Set(grouped.map((row) => row.courseId))]
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, name: true, category: true, maxCapacity: true },
  })
  const courseById = new Map(courses.map((course) => [course.id, course]))

  const countsByCourseId = new Map<string, { confirmed: number; waitlisted: number }>()
  for (const row of grouped) {
    const entry = countsByCourseId.get(row.courseId) ?? { confirmed: 0, waitlisted: 0 }
    if (row.status === 'CONFIRMED') entry.confirmed = row._count._all
    if (row.status === 'WAITLISTED') entry.waitlisted = row._count._all
    countsByCourseId.set(row.courseId, entry)
  }

  return courseIds
    .map((courseId) => {
      const course = courseById.get(courseId)
      const counts = countsByCourseId.get(courseId) ?? { confirmed: 0, waitlisted: 0 }
      const capacity = course?.maxCapacity ?? null
      const remaining = capacity != null ? Math.max(capacity - counts.confirmed, 0) : null
      const utilisation = capacity != null ? (counts.confirmed / capacity) * 100 : null
      return {
        courseId,
        courseName: course?.name ?? 'Unknown course',
        category: (course?.category ?? 'PROFESSIONAL_DEVELOPMENT') as CourseCategory,
        confirmed: counts.confirmed,
        waitlisted: counts.waitlisted,
        capacity,
        remaining,
        utilisation,
      }
    })
    .sort((a, b) => b.confirmed - a.confirmed)
}

/** Average Registrations per Course = confirmed registrations divided by courses with at least one confirmed registration. Derived from {@link getCoursePerformance} — never recomputed independently. */
export async function getAverageRegistrationsPerCourse(filters: AnalyticsFilters): Promise<number | null> {
  const rows = await getCoursePerformance(filters)
  const withConfirmed = rows.filter((row) => row.confirmed > 0)
  if (withConfirmed.length === 0) return null
  const total = withConfirmed.reduce((sum, row) => sum + row.confirmed, 0)
  return total / withConfirmed.length
}

export interface DistributionRow {
  label: string
  count: number
}

/** Subject distribution — built entirely from submitted teacher data, never a hardcoded list. Grouped by the normalised subject to collapse casing variants; the displayed label is the alphabetically-first original spelling in that group, so the label is deterministic. */
export async function getSubjectDistribution(filters: AnalyticsFilters): Promise<DistributionRow[]> {
  const whereSql = await buildWhereSql(filters, ['CONFIRMED'])
  const rows = await prisma.$queryRaw<{ label: string; count: bigint }[]>(Prisma.sql`
    SELECT MIN(t."subjectOriginal") AS "label", COUNT(*)::bigint AS "count"
    ${FROM_JOIN_SQL}
    WHERE ${whereSql}
    GROUP BY t."subjectNormalised"
    ORDER BY COUNT(*) DESC
  `)
  return rows.map((row) => ({ label: row.label, count: Number(row.count) }))
}

/** Grade distribution — same pattern as subject distribution, built from submitted data only. */
export async function getGradeDistribution(filters: AnalyticsFilters): Promise<DistributionRow[]> {
  const whereSql = await buildWhereSql(filters, ['CONFIRMED'])
  const rows = await prisma.$queryRaw<{ label: string; count: bigint }[]>(Prisma.sql`
    SELECT MIN(t."gradeOriginal") AS "label", COUNT(*)::bigint AS "count"
    ${FROM_JOIN_SQL}
    WHERE ${whereSql}
    GROUP BY t."gradeNormalised"
    ORDER BY COUNT(*) DESC
  `)
  return rows.map((row) => ({ label: row.label, count: Number(row.count) }))
}

export interface TopSchoolRow {
  schoolId: string
  schoolName: string
  confirmedRegistrations: number
}

/** Top schools by confirmed registrations. Pass no limit for "All". */
export async function getTopSchools(filters: AnalyticsFilters, limit?: number): Promise<TopSchoolRow[]> {
  const whereSql = await buildWhereSql(filters, ['CONFIRMED'])
  const rows = await prisma.$queryRaw<{ schoolId: string; schoolName: string | null; count: bigint }[]>(Prisma.sql`
    SELECT t."schoolId" AS "schoolId", s."canonicalName" AS "schoolName", COUNT(*)::bigint AS "count"
    ${FROM_JOIN_SQL}
    LEFT JOIN "School" s ON s."id" = t."schoolId"
    WHERE ${whereSql} AND t."schoolId" IS NOT NULL
    GROUP BY t."schoolId", s."canonicalName"
    ORDER BY COUNT(*) DESC, s."canonicalName" ASC
    ${limit != null ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}
  `)
  return rows.map((row) => ({
    schoolId: row.schoolId,
    schoolName: row.schoolName ?? 'Unknown school',
    confirmedRegistrations: Number(row.count),
  }))
}

export interface TeacherEngagementBreakdown {
  new: number
  engaged: number
  highlyEngaged: number
  returning: number
}

/** New Teacher = exactly 1 confirmed registration. Engaged = exactly 2. Highly Engaged = 3 or more. "Returning" (for the new-vs-returning chart) is engaged + highly engaged. */
export async function getTeacherEngagementBreakdown(filters: AnalyticsFilters): Promise<TeacherEngagementBreakdown> {
  const counts = await confirmedCountsByTeacher(filters)
  let newCount = 0
  let engaged = 0
  let highlyEngaged = 0
  for (const count of counts.values()) {
    const bucket = classifyEngagement(count)
    if (bucket === 'NEW') newCount++
    else if (bucket === 'ENGAGED') engaged++
    else if (bucket === 'HIGHLY_ENGAGED') highlyEngaged++
  }
  return { new: newCount, engaged, highlyEngaged, returning: engaged + highlyEngaged }
}

export { TEACHER_ENGAGEMENT_LABELS }

export interface TrendPoint {
  bucketStart: string
  count: number
}

/** Registration trend — confirmed registrations bucketed by Cairo calendar day/week/month. */
export async function getRegistrationTrend(filters: AnalyticsFilters, granularity: TrendGranularity): Promise<TrendPoint[]> {
  const whereSql = await buildWhereSql(filters, ['CONFIRMED'])
  const unit = granularity === 'DAY' ? 'day' : granularity === 'WEEK' ? 'week' : 'month'
  const rows = await prisma.$queryRaw<{ bucket: Date; count: bigint }[]>(Prisma.sql`
    SELECT date_trunc(${unit}, ${CAIRO_LOCAL_INSTANT_SQL}) AS "bucket", COUNT(*)::bigint AS "count"
    ${FROM_JOIN_SQL}
    WHERE ${whereSql}
    GROUP BY 1
    ORDER BY 1 ASC
  `)
  return rows.map((row) => ({ bucketStart: row.bucket.toISOString(), count: Number(row.count) }))
}

export interface FreeVsPaidBreakdown {
  free: number
  paid: number
}

/** Free registrations have courseFeeSnapshot = 0; everything else confirmed is paid. Never call this "revenue" — see the commercial-section note in the dashboard UI. */
export async function getFreeVsPaidBreakdown(filters: AnalyticsFilters): Promise<FreeVsPaidBreakdown> {
  const where = await buildWhere(filters, ['CONFIRMED'])
  const [free, total] = await Promise.all([
    prisma.registration.count({ where: { ...where, courseFeeSnapshot: 0 } }),
    prisma.registration.count({ where }),
  ])
  return { free, paid: total - free }
}

export interface PotentialValueByCourseRow {
  courseId: string
  courseName: string
  potentialValue: number
}

export async function getPotentialValueByCourse(filters: AnalyticsFilters): Promise<PotentialValueByCourseRow[]> {
  const where = await buildWhere(filters, ['CONFIRMED'])
  const grouped = await prisma.registration.groupBy({ by: ['courseId'], where, _sum: { courseFeeSnapshot: true } })
  if (grouped.length === 0) return []

  const courses = await prisma.course.findMany({
    where: { id: { in: grouped.map((row) => row.courseId) } },
    select: { id: true, name: true },
  })
  const nameById = new Map(courses.map((course) => [course.id, course.name]))

  return grouped
    .map((row) => ({
      courseId: row.courseId,
      courseName: nameById.get(row.courseId) ?? 'Unknown course',
      potentialValue: Number(row._sum.courseFeeSnapshot ?? 0),
    }))
    .sort((a, b) => b.potentialValue - a.potentialValue)
}

export interface PotentialValueByMonthRow {
  monthStart: string
  potentialValue: number
}

export async function getPotentialValueByMonth(filters: AnalyticsFilters): Promise<PotentialValueByMonthRow[]> {
  const whereSql = await buildWhereSql(filters, ['CONFIRMED'])
  const rows = await prisma.$queryRaw<{ bucket: Date; sum: string | null }[]>(Prisma.sql`
    SELECT date_trunc('month', ${CAIRO_LOCAL_INSTANT_SQL}) AS "bucket", SUM(r."courseFeeSnapshot")::text AS "sum"
    ${FROM_JOIN_SQL}
    WHERE ${whereSql}
    GROUP BY 1
    ORDER BY 1 ASC
  `)
  return rows.map((row) => ({ monthStart: row.bucket.toISOString(), potentialValue: Number(row.sum ?? 0) }))
}

export interface CommercialSummary {
  freeVsPaid: FreeVsPaidBreakdown
  potentialValueByCourse: PotentialValueByCourseRow[]
  potentialValueByMonth: PotentialValueByMonthRow[]
}

export async function getCommercialSummary(filters: AnalyticsFilters): Promise<CommercialSummary> {
  const [freeVsPaid, potentialValueByCourse, potentialValueByMonth] = await Promise.all([
    getFreeVsPaidBreakdown(filters),
    getPotentialValueByCourse(filters),
    getPotentialValueByMonth(filters),
  ])
  return { freeVsPaid, potentialValueByCourse, potentialValueByMonth }
}

// ---------------------------------------------------------------------------
// Filter options — populate the global filter bar from submitted data
// ---------------------------------------------------------------------------

export interface AnalyticsFilterOptions {
  courses: { id: string; name: string }[]
  categories: { value: CourseCategory; label: string }[]
  schools: { id: string; name: string }[]
  subjects: { value: string; label: string }[]
  grades: { value: string; label: string }[]
}

export async function getAnalyticsFilterOptions(): Promise<AnalyticsFilterOptions> {
  const [courses, schools, subjectRows, gradeRows] = await Promise.all([
    prisma.course.findMany({ select: { id: true, name: true }, orderBy: { courseDate: 'desc' } }),
    prisma.school.findMany({
      where: { teachers: { some: { registrations: { some: {} } } } },
      select: { id: true, canonicalName: true },
      orderBy: { canonicalName: 'asc' },
    }),
    prisma.teacher.findMany({
      where: { registrations: { some: {} } },
      select: { subjectNormalised: true, subjectOriginal: true },
      distinct: ['subjectNormalised'],
      orderBy: { subjectOriginal: 'asc' },
    }),
    prisma.teacher.findMany({
      where: { registrations: { some: {} } },
      select: { gradeNormalised: true, gradeOriginal: true },
      distinct: ['gradeNormalised'],
      orderBy: { gradeOriginal: 'asc' },
    }),
  ])

  return {
    courses,
    categories: (Object.keys(COURSE_CATEGORY_LABELS) as CourseCategory[]).map((value) => ({
      value,
      label: COURSE_CATEGORY_LABELS[value],
    })),
    schools: schools.map((school) => ({ id: school.id, name: school.canonicalName })),
    subjects: subjectRows.map((row) => ({ value: row.subjectNormalised, label: row.subjectOriginal })),
    grades: gradeRows.map((row) => ({ value: row.gradeNormalised, label: row.gradeOriginal })),
  }
}
