'use client'

import { Users } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { PayrollConfigEditor } from '@/components/staffing/payroll-config-editor'
import { PayrollForecastTable } from '@/components/staffing/payroll-forecast-table'
import { PayrollSummaryCards } from '@/components/staffing/payroll-summary-cards'
import { PositionEditor } from '@/components/staffing/position-editor'
import { useActiveProject, useCostModel, useHasHydrated, useProjectCostForecast } from '@/store/project-store'

export default function StaffingPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const costModel = useCostModel(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')

  return (
    <>
      <PageHeader title="Staffing" description="Positions, headcount and the payroll forecast." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={Users}
          title="No project yet"
          description="Complete setup before configuring staffing."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {project && costModel && costForecast ? (
        <div className="flex flex-col gap-6">
          <PayrollSummaryCards project={project} costForecast={costForecast} />
          <PositionEditor project={project} />
          <PayrollConfigEditor project={project} payroll={costModel.payroll} />
          <PayrollForecastTable project={project} costForecast={costForecast} />
        </div>
      ) : null}
    </>
  )
}
