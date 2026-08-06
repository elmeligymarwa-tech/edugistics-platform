'use client'

import { LayoutDashboard } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { ReviewAction } from '@/components/consultant/review-action'
import { useActiveProject, useHasHydrated, useProjectCostForecast, useProjectForecast } from '@/store/project-store'

export default function DashboardPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const forecast = useProjectForecast(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')

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
      {project && forecast && costForecast ? (
        <DashboardOverview project={project} forecast={forecast} costForecast={costForecast} />
      ) : null}
    </>
  )
}
