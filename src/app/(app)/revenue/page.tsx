'use client'

import { TrendingUp } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { RevenuePlanner } from '@/components/revenue/revenue-planner'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { useActiveProject, useHasHydrated, useProjectForecast } from '@/store/project-store'

export default function RevenuePage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const forecast = useProjectForecast(project?.id ?? '')

  return (
    <>
      <PageHeader title="Revenue" description="Fee structure, discounts and revenue assumptions." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={TrendingUp}
          title="No project yet"
          description="Complete setup to see the revenue forecast."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {project && forecast ? <RevenuePlanner project={project} forecast={forecast} /> : null}
    </>
  )
}
