'use client'

import { BarChart3 } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { useActiveProject, useHasHydrated } from '@/store/project-store'

export default function ReportsPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()

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
      {hasHydrated && project ? (
        <EmptyState
          icon={BarChart3}
          title="Reports aren't available yet"
          description="This module will let you export summaries and charts covering revenue, staffing and STM once those modules are complete. In the meantime, the Revenue page already has a CSV export for the forecast table. There's nothing else to configure here yet."
        />
      ) : null}
    </>
  )
}
