import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { YearForecast } from '@/engine/revenue'
import { formatMoney, formatNumber } from '@/lib/format'

export function SummaryCards({ project, year }: { project: Project; year: YearForecast }) {
  const meta = project.meta

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <StatTile label="Total students" value={formatNumber(year.students, meta.locale)} />
      <StatTile label="Gross revenue" value={formatMoney(year.grossRevenue, meta)} />
      <StatTile label="Discounts" value={formatMoney(year.discounts, meta)} />
      <StatTile label="Net revenue" value={formatMoney(year.netRevenue, meta)} />
      <StatTile label="Collected cash" value={formatMoney(year.collectedCash, meta)} />
      <StatTile label="STM liability" value={formatMoney(year.stmLiability, meta)} />
      <StatTile label="Revenue per student" value={formatMoney(year.revenuePerStudent, meta)} />
    </div>
  )
}
