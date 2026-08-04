import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatMoney, formatPercent } from '@/lib/format'

export function FinancialKpiCards({ project, forecast }: { project: Project; forecast: Forecast }) {
  const yearOne = forecast.years[0]
  const finalYear = forecast.years[forecast.years.length - 1]
  const averageRevenuePerStudent =
    forecast.years.length > 0
      ? forecast.years.reduce((sum, year) => sum + year.revenuePerStudent, 0) / forecast.years.length
      : 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Year one net revenue" value={formatMoney(yearOne?.netRevenue ?? 0, project.meta)} />
      <StatTile label="Final year net revenue" value={formatMoney(finalYear?.netRevenue ?? 0, project.meta)} />
      <StatTile label="Compound annual growth rate" value={formatPercent(forecast.cagrPct)} />
      <StatTile label="Average revenue per student" value={formatMoney(averageRevenuePerStudent, project.meta)} />
      <StatTile label="Year one STM liability" value={formatMoney(yearOne?.stmLiability ?? 0, project.meta)} />
    </div>
  )
}
