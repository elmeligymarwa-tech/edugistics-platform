'use client'

import { BarChart3 } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { ReportBuilder } from '@/components/reports/report-builder'
import { useActiveProject, useHasHydrated, useProjectCostForecast, useProjectForecast } from '@/store/project-store'

export default function ReportsPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const forecast = useProjectForecast(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')

  return (
    <>
      <PageHeader title="Reports" description="Exportable summaries and charts." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={BarChart3}
          title="No project yet"
          description="Complete setup before generating reports."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {project && forecast && costForecast ? (
        <ReportBuilder project={project} forecast={forecast} costForecast={costForecast} />
      ) : null}
    </>
  )
}
