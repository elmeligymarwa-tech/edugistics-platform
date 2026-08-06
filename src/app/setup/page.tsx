'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Presentation } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { useActiveProject, useHasHydrated, useProjectStore } from '@/store/project-store'
import { PresentationView } from './presentation-view'
import { SetupWizard } from './wizard'

function SetupPageContent({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const step = Number(searchParams.get('step'))
  const isPresenting = searchParams.get('present') === '1'
  const project = useProjectStore((state) => state.projects[projectId])

  if (!project) return null

  if (isPresenting) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <PageHeader title="Setup — presentation" description="A read-only summary, ready to project or print." />
          <Button type="button" variant="outline" size="sm" render={<Link href="/setup" />}>
            Exit presentation
          </Button>
        </div>
        <PresentationView project={project} />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <PageHeader title="Setup" description="School profile, academic calendar and year group capacity." />
        <Button type="button" variant="outline" size="sm" render={<Link href="/setup?present=1" />}>
          <Presentation data-icon="inline-start" />
          Present
        </Button>
      </div>
      <SetupWizard projectId={projectId} initialStep={Number.isFinite(step) && step > 0 ? step : undefined} />
    </div>
  )
}

export default function SetupPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const createProject = useProjectStore((state) => state.createProject)

  useEffect(() => {
    if (hasHydrated && !project) createProject()
  }, [hasHydrated, project, createProject])

  return project ? (
    <Suspense fallback={null}>
      <SetupPageContent projectId={project.id} />
    </Suspense>
  ) : null
}
