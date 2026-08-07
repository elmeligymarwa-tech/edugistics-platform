'use client'

import type { DrilldownContent } from '@/components/revenue/cell-drilldown-dialog'
import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatNumber } from '@/lib/format'
import { pctChange, remainingSchoolCapacity, totalYearGroupCapacity, type TrendPoint } from '@/lib/kpi'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import type { ComparisonTarget } from './dashboard-overview'
import { KpiCard } from './kpi-card'

/**
 * Max School Students (`revenueAssumptions.schoolPlan.maxSchoolStudents`) as a live planning
 * constraint: how much year group capacity exists, how many students the selected year
 * actually plans for, and how much headroom is left against the school-wide ceiling.
 */
export function SchoolCapacityKpiBand({
  project,
  forecast,
  yearIndex,
  comparison,
  onOpenDrilldown,
}: {
  project: Project
  forecast: Forecast
  yearIndex: number
  comparison: ComparisonTarget
  onOpenDrilldown: (content: DrilldownContent) => void
}) {
  const year = forecast.years[yearIndex]
  if (!year) return null

  const locale = project.meta.locale
  const maxSchoolStudents = project.revenueAssumptions.schoolPlan.maxSchoolStudents

  const totalCapacity = totalYearGroupCapacity(year.enrolment)
  const currentIntake = year.students
  const remaining = remainingSchoolCapacity(maxSchoolStudents, currentIntake)

  const comparisonYear =
    comparison.forecast && comparison.yearIndex !== null ? comparison.forecast.years[comparison.yearIndex] : undefined
  const comparisonCapacity = comparisonYear ? totalYearGroupCapacity(comparisonYear.enrolment) : null
  const comparisonRemaining = comparisonYear ? remainingSchoolCapacity(maxSchoolStudents, comparisonYear.students) : null

  const capacityTrend: TrendPoint[] = forecast.years.map((y) => ({ label: y.label, value: totalYearGroupCapacity(y.enrolment) }))
  const intakeTrend: TrendPoint[] = forecast.years.map((y) => ({ label: y.label, value: y.students }))
  const remainingTrend: TrendPoint[] = []
  forecast.years.forEach((y) => {
    const value = remainingSchoolCapacity(maxSchoolStudents, y.students)
    if (value !== null) remainingTrend.push({ label: y.label, value })
  })

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-heading">School capacity</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total Year Group Capacity"
          value={formatNumber(totalCapacity, locale)}
          comparisonValue={comparisonYear ? formatNumber(comparisonCapacity ?? 0, locale) : null}
          comparisonLabel={`vs ${comparison.label}`}
          deltaPct={comparisonYear ? pctChange(totalCapacity, comparisonCapacity ?? 0) : null}
          trend={capacityTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Total Year Group Capacity',
              description: `${year.label} — sum of each year group's own capacity, not a separate overall school ceiling.`,
              rows: [
                ...year.enrolment.map((entry) => ({
                  label: YEAR_GROUP_LABELS[entry.yearGroup] ?? entry.yearGroup,
                  value: formatNumber(entry.capacityCeiling, locale),
                })),
                { label: 'Total Year Group Capacity', value: formatNumber(totalCapacity, locale), emphasis: true },
              ],
            })
          }
        />
        <KpiCard
          label="Current Student Intake"
          value={formatNumber(currentIntake, locale)}
          comparisonValue={comparisonYear ? formatNumber(comparisonYear.students, locale) : null}
          comparisonLabel={`vs ${comparison.label}`}
          deltaPct={comparisonYear ? pctChange(currentIntake, comparisonYear.students) : null}
          trend={intakeTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Current Student Intake',
              description: `${year.label} — planned students across every open year group.`,
              rows: [
                ...year.enrolment.map((entry) => ({
                  label: YEAR_GROUP_LABELS[entry.yearGroup] ?? entry.yearGroup,
                  value: formatNumber(entry.students, locale),
                })),
                { label: 'Current Student Intake', value: formatNumber(currentIntake, locale), emphasis: true },
              ],
            })
          }
        />
        <KpiCard
          label="Remaining School Capacity"
          value={remaining === null ? 'No limit set' : formatNumber(remaining, locale)}
          comparisonValue={comparisonYear && comparisonRemaining !== null ? formatNumber(comparisonRemaining, locale) : null}
          comparisonLabel={`vs ${comparison.label}`}
          deltaPct={
            comparisonYear && remaining !== null && comparisonRemaining !== null
              ? pctChange(remaining, comparisonRemaining)
              : null
          }
          trend={remainingTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Remaining School Capacity',
              description:
                maxSchoolStudents === null
                  ? `${year.label} — set a Maximum school students ceiling in Setup to track headroom.`
                  : `${year.label} — Max School Students minus Current Student Intake.`,
              rows:
                maxSchoolStudents === null
                  ? [{ label: 'Max School Students', value: 'No limit set' }]
                  : [
                      { label: 'Max School Students', value: formatNumber(maxSchoolStudents, locale) },
                      { label: 'Current Student Intake', value: formatNumber(currentIntake, locale) },
                      {
                        label: 'Remaining School Capacity',
                        value: formatNumber(remaining ?? 0, locale),
                        emphasis: true,
                      },
                    ],
            })
          }
        />
      </div>
    </div>
  )
}
