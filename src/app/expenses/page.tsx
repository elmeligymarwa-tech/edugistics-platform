'use client'

import { Receipt } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { CapexEditor } from '@/components/expenses/capex-editor'
import { ChartCostMix } from '@/components/expenses/chart-cost-mix'
import { ChartCostPerStudent } from '@/components/expenses/chart-cost-per-student'
import { ExpenseForecastTable } from '@/components/expenses/expense-forecast-table'
import { OpexCategoryEditor } from '@/components/expenses/opex-category-editor'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { useActiveProject, useCostModel, useHasHydrated, useProjectCostForecast } from '@/store/project-store'

export default function ExpensesPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const costModel = useCostModel(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')

  return (
    <>
      <PageHeader title="Expenses" description="Operating costs outside staffing." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={Receipt}
          title="No project yet"
          description="Complete setup before recording operational expenses."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {project && costModel && costForecast ? (
        <div className="flex flex-col gap-6">
          <OpexCategoryEditor projectId={project.id} opex={costModel.opex} />
          <CapexEditor project={project} capex={costModel.capex} costForecast={costForecast} />
          <ExpenseForecastTable project={project} opex={costModel.opex} costForecast={costForecast} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCostMix project={project} opex={costModel.opex} costForecast={costForecast} />
            <ChartCostPerStudent project={project} costForecast={costForecast} />
          </div>
        </div>
      ) : null}
    </>
  )
}
