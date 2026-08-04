'use client'

import Link from 'next/link'

import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { RevenuePlanner } from '@/components/revenue/revenue-planner'
import { useActiveProject, useHasHydrated, useProjectForecast } from '@/store/project-store'

export default function RevenuePage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const forecast = useProjectForecast(project?.id ?? '')

  return (
    <>
      <PageHeader title="Revenue" description="Fee structure, discounts and revenue assumptions." />
      {hasHydrated && !project ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No project yet. Complete setup to see the revenue forecast.
          </p>
          <Button render={<Link href="/setup" />}>Go to setup</Button>
        </div>
      ) : null}
      {project && forecast ? <RevenuePlanner project={project} forecast={forecast} /> : null}
    </>
  )
}
