'use client'

import { GitBranch } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { ScenarioComparison } from '@/components/scenarios/scenario-comparison'
import { ScenarioPanel } from '@/components/scenarios/scenario-panel'
import { useActiveProject, useHasHydrated, useProjectStore } from '@/store/project-store'

export default function ScenariosPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const scenarios = useProjectStore((state) => state.scenarios)

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
      {project ? (
        <div className="flex flex-col gap-6">
          <ScenarioPanel project={project} scenarios={scenarios} />
          <ScenarioComparison project={project} scenarios={scenarios} />
        </div>
      ) : null}
    </>
  )
}
