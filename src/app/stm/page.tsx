'use client'

import { Handshake } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { StmOverview } from '@/components/stm/stm-overview'
import {
  useActiveProject,
  useHasHydrated,
  useProjectCostForecast,
  useProjectForecast,
} from '@/store/project-store'

export default function StmPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const forecast = useProjectForecast(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')

  return (
    <>
      <PageHeader
        title="STM"
        description="Third-party revenue-share and management fee agreements."
      />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={Handshake}
          title="No project yet"
          description="Complete setup to configure STM agreements and see the computed liability."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {hasHydrated && project && forecast && costForecast ? (
        <StmOverview project={project} forecast={forecast} costForecast={costForecast} />
      ) : null}
    </>
  )
}
