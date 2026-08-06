'use client'

import { FileText } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { ModelWarningBanner } from '@/components/reports/model-warning-banner'
import { ReviewAction } from '@/components/consultant/review-action'
import { BalanceSheetTable } from '@/components/statements/balance-sheet-table'
import { BreakEvenPanel } from '@/components/statements/break-even-panel'
import { CashFlowTable } from '@/components/statements/cash-flow-table'
import { ProfitAndLossTable } from '@/components/statements/profit-and-loss-table'
import { capitalForecastToDisplay, costForecastToDisplay, toDisplayMeta } from '@/lib/currency-display'
import {
  useActiveProject,
  useCapitalModel,
  useCostModel,
  useHasHydrated,
  useProjectCapitalForecast,
  useProjectCostForecast,
} from '@/store/project-store'
import { useCurrencyDisplayStore } from '@/store/currency-display-store'

export default function StatementsPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const costModel = useCostModel(project?.id ?? '')
  const capitalModel = useCapitalModel(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')
  const capitalForecast = useProjectCapitalForecast(project?.id ?? '')
  const showUsd = useCurrencyDisplayStore((state) => state.showUsd)

  const displayProject =
    project && showUsd ? { ...project, meta: toDisplayMeta(project.meta, true) } : project
  const displayCostForecast =
    project && costForecast ? costForecastToDisplay(costForecast, project.meta, showUsd) : costForecast
  const displayCapitalForecast =
    project && capitalForecast ? capitalForecastToDisplay(capitalForecast, project.meta, showUsd) : capitalForecast

  return (
    <>
      <PageHeader
        title="Statements"
        description="Generated financial statements by year."
        actions={project && costForecast ? <ReviewAction project={project} forecast={costForecast} /> : null}
      />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={FileText}
          title="No project yet"
          description="Complete setup before financial statements can be generated."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {displayProject && costModel && capitalModel && displayCostForecast && displayCapitalForecast ? (
        <div className="flex flex-col gap-6">
          <ModelWarningBanner project={displayProject} costModel={costModel} capitalModel={capitalModel} />
          <BreakEvenPanel project={displayProject} costForecast={displayCostForecast} />
          <ProfitAndLossTable
            project={displayProject}
            costForecast={displayCostForecast}
            capitalForecast={displayCapitalForecast}
          />
          <CashFlowTable project={displayProject} costForecast={displayCostForecast} capitalForecast={displayCapitalForecast} />
          <BalanceSheetTable project={displayProject} capitalForecast={displayCapitalForecast} />
        </div>
      ) : null}
    </>
  )
}
