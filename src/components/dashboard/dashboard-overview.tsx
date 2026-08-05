import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import type { CostForecast } from '@/engine/costs'
import { ChartCashCurve } from './chart-cash-curve'
import { ChartRevenueVsCost } from './chart-revenue-vs-cost'
import { FinancialKpiCards } from './financial-kpi-cards'
import { OverviewKpiCards } from './overview-kpi-cards'
import { SetupCompletionCard } from './setup-completion-card'
import { StatementKpiCards } from './statement-kpi-cards'

export function DashboardOverview({
  project,
  forecast,
  costForecast,
}: {
  project: Project
  forecast: Forecast
  costForecast: CostForecast
}) {
  return (
    <div className="flex flex-col gap-6">
      <SetupCompletionCard project={project} />
      <OverviewKpiCards project={project} forecast={forecast} />
      <FinancialKpiCards project={project} forecast={forecast} />
      <StatementKpiCards project={project} costForecast={costForecast} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartRevenueVsCost project={project} costForecast={costForecast} />
        <ChartCashCurve project={project} costForecast={costForecast} />
      </div>
    </div>
  )
}
