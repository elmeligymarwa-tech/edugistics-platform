'use client'

import Link from 'next/link'

import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { useActiveProject, useHasHydrated, useProjectForecast } from '@/store/project-store'

export default function DashboardPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const forecast = useProjectForecast(project?.id ?? '')

  return (
    <>
      <PageHeader title="Dashboard" description="An overview of enrolment, revenue and cash position." />
      {hasHydrated && !project ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">No project yet. Complete setup to see the dashboard.</p>
          <Button render={<Link href="/setup" />}>Go to setup</Button>
        </div>
      ) : null}
      {project && forecast ? <DashboardOverview project={project} forecast={forecast} /> : null}
    </>
  )
}
