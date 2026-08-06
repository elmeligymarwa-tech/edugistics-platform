'use client'

import { LayoutDashboard } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { ModelWarningBanner } from '@/components/reports/model-warning-banner'
import { ReviewAction } from '@/components/consultant/review-action'
import { costForecastToDisplay, revenueForecastToDisplay, toDisplayMeta } from '@/lib/currency-display'
import {
  useActiveProject,
  useCapitalModel,
  useCostModel,
  useHasHydrated,
  useProjectCostForecast,
  useProjectForecast,
} from '@/store/project-store'
import { useCurrencyDisplayStore } from '@/store/currency-display-store'

export default function DashboardPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const costModel = useCostModel(project?.id ?? '')
  const capitalModel = useCapitalModel(project?.id ?? '')
  const forecast = useProjectForecast(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')
  const showUsd = useCurrencyDisplayStore((state) => state.showUsd)

  const displayProject =
    project && showUsd ? { ...project, meta: toDisplayMeta(project.meta, true) } : project
  const displayForecast =
    project && forecast ? revenueForecastToDisplay(forecast, project.meta, showUsd) : forecast
  const displayCostForecast =
    project && costForecast ? costForecastToDisplay(costForecast, project.meta, showUsd) : costForecast

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of enrolment, revenue and cash position."
        actions={project && costForecast ? <ReviewAction project={project} forecast={costForecast} /> : null}
      />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No project yet"
          description="Complete setup to see the dashboard."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {displayProject && costModel && displayForecast && displayCostForecast ? (
        <div className="flex flex-col gap-6">
          <ModelWarningBanner
            project={displayProject}
            costModel={costModel}
            capitalModel={capitalModel ?? undefined}
          />
          <DashboardOverview project={displayProject} forecast={displayForecast} costForecast={displayCostForecast} />
        </div>
      ) : null}
    </>
  )
}
