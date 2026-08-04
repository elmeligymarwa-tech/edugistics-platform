import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { FinancialKpiCards } from './financial-kpi-cards'
import { OverviewKpiCards } from './overview-kpi-cards'
import { SetupCompletionCard } from './setup-completion-card'

export function DashboardOverview({ project, forecast }: { project: Project; forecast: Forecast }) {
  return (
    <div className="flex flex-col gap-6">
      <SetupCompletionCard project={project} />
      <OverviewKpiCards project={project} forecast={forecast} />
      <FinancialKpiCards project={project} forecast={forecast} />
    </div>
  )
}
