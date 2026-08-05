import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatMoney } from '@/lib/format'

export function BreakEvenPanel({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const breakEvenLabel =
    costForecast.breakEvenYearIndex !== null
      ? (costForecast.years[costForecast.breakEvenYearIndex]?.label ?? 'Not within forecast')
      : 'Not within forecast'

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile label="Break-even year" value={breakEvenLabel} />
      <StatTile label="Cash low point" value={formatMoney(costForecast.cashLowPoint, project.meta)} />
      <StatTile
        label="Peak funding requirement"
        value={formatMoney(costForecast.peakFundingRequirement, project.meta)}
      />
    </div>
  )
}
