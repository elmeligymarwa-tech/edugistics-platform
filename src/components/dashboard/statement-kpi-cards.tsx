import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatMoney, formatPercent } from '@/lib/format'

export function StatementKpiCards({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const yearOne = costForecast.years[0]
  const finalYear = costForecast.years[costForecast.years.length - 1]
  const breakEvenLabel =
    costForecast.breakEvenYearIndex !== null
      ? (costForecast.years[costForecast.breakEvenYearIndex]?.label ?? 'Not within forecast')
      : 'Not within forecast'

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="Year one EBITDA" value={formatMoney(yearOne?.ebitda ?? 0, project.meta)} />
      <StatTile label="Final year EBITDA" value={formatMoney(finalYear?.ebitda ?? 0, project.meta)} />
      <StatTile label="EBITDA margin" value={formatPercent(finalYear?.ebitdaMarginPct ?? 0)} />
      <StatTile label="Break-even year" value={breakEvenLabel} />
      <StatTile
        label="Peak funding requirement"
        value={formatMoney(costForecast.peakFundingRequirement, project.meta)}
      />
      <StatTile label="Cost per student" value={formatMoney(finalYear?.costPerStudent ?? 0, project.meta)} />
    </div>
  )
}
