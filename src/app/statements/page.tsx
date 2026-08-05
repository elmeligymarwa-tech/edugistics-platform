'use client'

import { FileText } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { BreakEvenPanel } from '@/components/statements/break-even-panel'
import { CashFlowTable } from '@/components/statements/cash-flow-table'
import { ProfitAndLossTable } from '@/components/statements/profit-and-loss-table'
import { useActiveProject, useHasHydrated, useProjectCostForecast } from '@/store/project-store'

export default function StatementsPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const costForecast = useProjectCostForecast(project?.id ?? '')

  return (
    <>
      <PageHeader title="Statements" description="Generated financial statements by year." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={FileText}
          title="No project yet"
          description="Complete setup before financial statements can be generated."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {project && costForecast ? (
        <div className="flex flex-col gap-6">
          <BreakEvenPanel project={project} costForecast={costForecast} />
          <ProfitAndLossTable project={project} costForecast={costForecast} />
          <CashFlowTable project={project} costForecast={costForecast} />
        </div>
      ) : null}
    </>
  )
}
