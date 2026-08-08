import { Suspense } from 'react'
import type { Metadata } from 'next'

import { StatTile } from '@/components/ui/stat-tile'
import { AnalyticsFilterBar } from '@/components/training/admin/analytics-filter-bar'
import { CommercialSection } from '@/components/training/admin/analytics/commercial-section'
import { CoursePerformancePanel } from '@/components/training/admin/analytics/course-performance-panel'
import { DistributionPanel } from '@/components/training/admin/analytics/distribution-panel'
import { RegistrationTrendPanel } from '@/components/training/admin/analytics/registration-trend-panel'
import { TeacherEngagementPanel } from '@/components/training/admin/analytics/teacher-engagement-panel'
import { TopSchoolsPanel } from '@/components/training/admin/analytics/top-schools-panel'
import { parseAnalyticsSearchParams, type TrendGranularity } from '@/domain/training/analytics'
import { formatCourseFee } from '@/domain/training/format'
import {
  getAnalyticsFilterOptions,
  getAverageRegistrationsPerCourse,
  getCommercialSummary,
  getCoursePerformance,
  getDashboardKpis,
  getGradeDistribution,
  getRegistrationTrend,
  getSubjectDistribution,
  getTeacherEngagementBreakdown,
  getTopSchools,
} from '@/lib/training/analytics'

export const metadata: Metadata = {
  title: 'Analytics — Edugistics Training Admin',
}

interface AnalyticsSearchParams {
  [key: string]: string | undefined
  range?: string
  from?: string
  to?: string
  courseIds?: string
  categories?: string
  schoolIds?: string
  subjects?: string
  grades?: string
}

export default async function TrainingAnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>
}) {
  const params = await searchParams
  const { filters } = parseAnalyticsSearchParams(params)

  const [
    options,
    kpis,
    coursePerformance,
    averageRegistrationsPerCourse,
    subjectDistribution,
    gradeDistribution,
    topSchools,
    teacherEngagement,
    commercial,
    trendDay,
    trendWeek,
    trendMonth,
  ] = await Promise.all([
    getAnalyticsFilterOptions(),
    getDashboardKpis(filters),
    getCoursePerformance(filters),
    getAverageRegistrationsPerCourse(filters),
    getSubjectDistribution(filters),
    getGradeDistribution(filters),
    getTopSchools(filters),
    getTeacherEngagementBreakdown(filters),
    getCommercialSummary(filters),
    getRegistrationTrend(filters, 'DAY'),
    getRegistrationTrend(filters, 'WEEK'),
    getRegistrationTrend(filters, 'MONTH'),
  ])

  const trends: Record<TrendGranularity, Awaited<ReturnType<typeof getRegistrationTrend>>> = {
    DAY: trendDay,
    WEEK: trendWeek,
    MONTH: trendMonth,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-heading">Edugistics Training Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrations, teachers and schools across every training course. Filters apply to every panel on this page.
        </p>
      </div>

      <Suspense>
        <AnalyticsFilterBar options={options} />
      </Suspense>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Registrations" value={kpis.registrations} />
        <StatTile label="Unique teachers" value={kpis.uniqueTeachers} />
        <StatTile label="Unique schools" value={kpis.uniqueSchools} />
        <StatTile label="Active courses" value={kpis.activeCourses} />
        <StatTile label="Repeat teachers" value={kpis.repeatTeachers} />
        <StatTile label="Potential value" value={formatCourseFee(kpis.potentialValue, 'EGP')} />
      </div>

      <RegistrationTrendPanel trends={trends} />

      <CoursePerformancePanel rows={coursePerformance} averageRegistrationsPerCourse={averageRegistrationsPerCourse} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionPanel
          title="Subject distribution"
          seriesName="Confirmed registrations"
          emptyMessage="No subjects submitted for the current filters."
          rows={subjectDistribution}
        />
        <DistributionPanel
          title="Grade distribution"
          seriesName="Confirmed registrations"
          emptyMessage="No grades submitted for the current filters."
          rows={gradeDistribution}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopSchoolsPanel schools={topSchools} />
        <TeacherEngagementPanel breakdown={teacherEngagement} />
      </div>

      <CommercialSection summary={commercial} />
    </div>
  )
}
