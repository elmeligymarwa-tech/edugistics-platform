'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat-tile'
import { formatCourseFee } from '@/domain/training/format'
import type { CommercialSummary } from '@/lib/training/analytics'
import { AnalyticsBarChart } from './analytics-bar-chart'
import { AnalyticsEmptyState } from './empty-state'

function formatEgp(amount: number): string {
  return formatCourseFee(amount, 'EGP')
}

function formatMonthLabel(monthStart: string): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(monthStart))
}

export function CommercialSection({ summary }: { summary: CommercialSummary }) {
  const { freeVsPaid, potentialValueByCourse, potentialValueByMonth } = summary
  const byCourseData = potentialValueByCourse.map((row) => ({ label: row.courseName, value: row.potentialValue }))
  const byMonthData = potentialValueByMonth.map((row) => ({ label: formatMonthLabel(row.monthStart), value: row.potentialValue }))

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-heading">Commercial</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Potential Registration Value reflects course fees for confirmed registrations only — it is not revenue and does not
          mean payment has been received. Payment is collected outside this system.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Free registrations" value={freeVsPaid.free} />
        <StatTile label="Paid registrations" value={freeVsPaid.paid} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Potential Registration Value by course</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            {byCourseData.length === 0 ? (
              <AnalyticsEmptyState message="No confirmed registrations for the current filters." />
            ) : (
              <AnalyticsBarChart data={byCourseData} seriesName="Potential value" valueFormatter={formatEgp} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Potential Registration Value by month</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            {byMonthData.length === 0 ? (
              <AnalyticsEmptyState message="No confirmed registrations for the current filters." />
            ) : (
              <AnalyticsBarChart data={byMonthData} seriesName="Potential value" valueFormatter={formatEgp} />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
