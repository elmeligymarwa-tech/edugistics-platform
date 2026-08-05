'use client'

import { GitBranch } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { useActiveProject, useHasHydrated } from '@/store/project-store'

export default function ScenariosPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()

  return (
    <>
      <PageHeader title="Scenarios" description="Compare alternative planning assumptions." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={GitBranch}
          title="No project yet"
          description="Complete setup before planning scenarios."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {hasHydrated && project ? (
        <EmptyState
          icon={GitBranch}
          title="Scenario planning isn't available yet"
          description="This module will let you branch this project's assumptions and compare the resulting forecasts side by side. There's nothing to configure here yet."
        />
      ) : null}
    </>
  )
}
