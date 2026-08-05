'use client'

import { Users } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { StaffingOverview } from '@/components/staffing/staffing-overview'
import { useActiveProject, useHasHydrated } from '@/store/project-store'

export default function StaffingPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()

  return (
    <>
      <PageHeader title="Staffing" description="Positions, salaries and staffing costs." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={Users}
          title="No project yet"
          description="Complete setup to configure staffing positions and see them here."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {hasHydrated && project ? <StaffingOverview project={project} /> : null}
    </>
  )
}
