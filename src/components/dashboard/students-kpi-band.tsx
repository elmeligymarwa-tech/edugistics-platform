'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { DrilldownContent } from '@/components/revenue/cell-drilldown-dialog'
import { ChartTooltip, renderChartLegend } from '@/components/revenue/chart-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { orderedYearGroups, type Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatNumber, formatPercent } from '@/lib/format'
import { capacityUtilisationPct, newEntrantsForYear, pctChange, studentGrowthSeries, type TrendPoint } from '@/lib/kpi'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import type { ComparisonTarget } from './dashboard-overview'
import { KpiCard } from './kpi-card'

export function StudentsKpiBand({
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

  const groups = orderedYearGroups(project)
  const locale = project.meta.locale

  const totalStudents = year.students
  const capacityUtil = capacityUtilisationPct(year.enrolment)
  const newEntrants = newEntrantsForYear(year.enrolment)
  const growthSeries = studentGrowthSeries(forecast)
  const growth = growthSeries[yearIndex] ?? null

  const comparisonYear =
    comparison.forecast && comparison.yearIndex !== null ? comparison.forecast.years[comparison.yearIndex] : undefined
  const comparisonGrowthSeries = comparison.forecast ? studentGrowthSeries(comparison.forecast) : null
  const comparisonGrowth =
    comparisonGrowthSeries && comparison.yearIndex !== null ? (comparisonGrowthSeries[comparison.yearIndex] ?? null) : null

  const totalsTrend: TrendPoint[] = forecast.years.map((y) => ({ label: y.label, value: y.students }))
  const utilTrend: TrendPoint[] = forecast.years.map((y) => ({ label: y.label, value: capacityUtilisationPct(y.enrolment) }))
  const entrantsTrend: TrendPoint[] = forecast.years.map((y) => ({ label: y.label, value: newEntrantsForYear(y.enrolment) }))
  const growthTrend: TrendPoint[] = []
  forecast.years.forEach((y, index) => {
    const value = growthSeries[index]
    if (value !== null) growthTrend.push({ label: y.label, value })
  })

  const byYearGroupData = groups.map((group) => {
    const current = year.enrolment.find((e) => e.yearGroup === group)?.students ?? 0
    const compared = comparisonYear?.enrolment.find((e) => e.yearGroup === group)?.students ?? null
    return { group, label: YEAR_GROUP_LABELS[group] ?? group, current, compared }
  })

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-heading">Students</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Total students"
          value={formatNumber(totalStudents, locale)}
          comparisonValue={comparisonYear ? formatNumber(comparisonYear.students, locale) : null}
          comparisonLabel={`vs ${comparison.label}`}
          deltaPct={comparisonYear ? pctChange(totalStudents, comparisonYear.students) : null}
          trend={totalsTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Total students',
              description: `${year.label} — built from enrolment by year group.`,
              rows: [
                ...year.enrolment.map((entry) => ({
                  label: YEAR_GROUP_LABELS[entry.yearGroup] ?? entry.yearGroup,
                  value: `${formatNumber(entry.students, locale)} of ${formatNumber(entry.capacityCeiling, locale)} places`,
                })),
                { label: 'Total students', value: formatNumber(totalStudents, locale), emphasis: true },
              ],
            })
          }
        />
        <KpiCard
          label="Capacity utilisation"
          term="occupancy"
          value={formatPercent(capacityUtil)}
          glossaryValue={formatPercent(capacityUtil)}
          comparisonValue={comparisonYear ? formatPercent(capacityUtilisationPct(comparisonYear.enrolment)) : null}
          comparisonLabel={`vs ${comparison.label}`}
          deltaPct={comparisonYear ? pctChange(capacityUtil, capacityUtilisationPct(comparisonYear.enrolment)) : null}
          trend={utilTrend}
          onOpenDrilldown={() => {
            const totalCeiling = year.enrolment.reduce((sum, e) => sum + e.capacityCeiling, 0)
            onOpenDrilldown({
              title: 'Capacity utilisation',
              description: `${year.label} — total students over total capacity ceiling, by year group.`,
              rows: [
                ...year.enrolment.map((entry) => ({
                  label: YEAR_GROUP_LABELS[entry.yearGroup] ?? entry.yearGroup,
                  value: `${formatNumber(entry.students, locale)} / ${formatNumber(entry.capacityCeiling, locale)}`,
                })),
                { label: 'Total students', value: formatNumber(totalStudents, locale) },
                { label: 'Total capacity ceiling', value: formatNumber(totalCeiling, locale) },
                { label: 'Capacity utilisation', value: formatPercent(capacityUtil), emphasis: true },
              ],
            })
          }}
        />
        <KpiCard
          label="New entrants"
          value={formatNumber(newEntrants, locale)}
          comparisonValue={comparisonYear ? formatNumber(newEntrantsForYear(comparisonYear.enrolment), locale) : null}
          comparisonLabel={`vs ${comparison.label}`}
          deltaPct={comparisonYear ? pctChange(newEntrants, newEntrantsForYear(comparisonYear.enrolment)) : null}
          trend={entrantsTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'New entrants',
              description: `${year.label} — gross joiners by year group, including replacements for leavers.`,
              rows: [
                ...year.enrolment
                  .filter((entry) => entry.newEntrants > 0)
                  .map((entry) => ({
                    label: YEAR_GROUP_LABELS[entry.yearGroup] ?? entry.yearGroup,
                    value: formatNumber(entry.newEntrants, locale),
                  })),
                { label: 'Total new entrants', value: formatNumber(newEntrants, locale), emphasis: true },
              ],
            })
          }
        />
        <KpiCard
          label="Student growth"
          value={growth === null ? '—' : formatPercent(growth)}
          comparisonValue={comparisonGrowth === null ? null : formatPercent(comparisonGrowth)}
          comparisonLabel={`vs ${comparison.label}`}
          deltaPct={growth !== null && comparisonGrowth !== null ? pctChange(growth, comparisonGrowth) : null}
          trend={growthTrend}
          onOpenDrilldown={() => {
            const prior = forecast.years[yearIndex - 1]
            onOpenDrilldown({
              title: 'Student growth',
              description: `${year.label} — change in total students versus the prior forecast year.`,
              rows: [
                { label: prior ? prior.label : 'Prior year', value: prior ? formatNumber(prior.students, locale) : 'No prior year in forecast' },
                { label: year.label, value: formatNumber(totalStudents, locale) },
                { label: 'Growth', value: growth === null ? 'Not available for the first forecast year' : formatPercent(growth), emphasis: true },
              ],
            })
          }}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Students by year group</CardTitle>
        </CardHeader>
        <CardContent
          className="h-64 cursor-pointer pt-0"
          role="button"
          tabIndex={0}
          onClick={() =>
            onOpenDrilldown({
              title: 'Students by year group',
              description: `${year.label} vs ${comparison.label}.`,
              rows: byYearGroupData.map((entry) => ({
                label: entry.label,
                value: entry.compared === null ? formatNumber(entry.current, locale) : `${formatNumber(entry.current, locale)} (was ${formatNumber(entry.compared, locale)})`,
              })),
            })
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byYearGroupData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickFormatter={(value: number) => formatNumber(value, locale)}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                content={(tooltipProps) => (
                  <ChartTooltip {...tooltipProps} meta={project.meta} valueFormatter={(value) => formatNumber(value, locale)} />
                )}
              />
              <Legend content={renderChartLegend} />
              <Bar dataKey="current" name={year.label} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="compared" name={comparison.label} fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
