'use client'

import { Landmark } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { CapitalStructureWarning } from '@/components/financing/capital-structure-warning'
import { EquityEditor } from '@/components/financing/equity-editor'
import { FinancingSummaryCards } from '@/components/financing/financing-summary-cards'
import { LoanEditor } from '@/components/financing/loan-editor'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { capitalForecastToDisplay, toDisplayMeta } from '@/lib/currency-display'
import { toUsd } from '@/engine/analysis'
import {
  useActiveProject,
  useCapitalModel,
  useCostModel,
  useHasHydrated,
  useProjectCapitalForecast,
} from '@/store/project-store'
import { useCurrencyDisplayStore } from '@/store/currency-display-store'

export default function FinancingPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const costModel = useCostModel(project?.id ?? '')
  const capitalModel = useCapitalModel(project?.id ?? '')
  const capitalForecast = useProjectCapitalForecast(project?.id ?? '')
  const showUsd = useCurrencyDisplayStore((state) => state.showUsd)

  const displayMeta = project ? toDisplayMeta(project.meta, showUsd) : null
  const displayProject = project && displayMeta ? { ...project, meta: displayMeta } : project
  const displayCapitalForecast =
    project && capitalForecast ? capitalForecastToDisplay(capitalForecast, project.meta, showUsd) : capitalForecast

  return (
    <>
      <PageHeader title="Financing" description="Equity, loans and the debt schedule that funds the plan." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={Landmark}
          title="No project yet"
          description="Complete setup before planning financing."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {project && displayProject && costModel && capitalModel && displayCapitalForecast && displayMeta ? (
        <div className="flex flex-col gap-6">
          <FinancingSummaryCards project={displayProject} capitalForecast={displayCapitalForecast} />
          <CapitalStructureWarning
            meta={displayMeta}
            openingShareCapital={
              showUsd
                ? toUsd(capitalModel.equity.openingShareCapital, project.meta, 0)
                : capitalModel.equity.openingShareCapital
            }
            openingCash={
              showUsd ? toUsd(costModel.financing.openingCash, project.meta, 0) : costModel.financing.openingCash
            }
            openingFixedAssets={
              showUsd ? toUsd(capitalModel.openingFixedAssets, project.meta, 0) : capitalModel.openingFixedAssets
            }
          />
          <EquityEditor projectId={project.id} capital={capitalModel} />
          <LoanEditor
            project={project}
            loans={capitalModel.loans}
            loanSchedules={capitalForecast?.loans ?? {}}
            yearLabels={capitalForecast?.years.map((year) => year.label) ?? []}
          />
        </div>
      ) : null}
    </>
  )
}
