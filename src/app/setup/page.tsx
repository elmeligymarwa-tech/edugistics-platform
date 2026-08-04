'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import { PageHeader } from '@/components/app-shell/page-header'
import { useActiveProject, useHasHydrated, useProjectStore } from '@/store/project-store'
import { SetupWizard } from './wizard'

function SetupWizardWithStep({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const step = Number(searchParams.get('step'))
  return <SetupWizard projectId={projectId} initialStep={Number.isFinite(step) && step > 0 ? step : undefined} />
}

export default function SetupPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const createProject = useProjectStore((state) => state.createProject)

  useEffect(() => {
    if (hasHydrated && !project) createProject()
  }, [hasHydrated, project, createProject])

  return (
    <>
      <PageHeader
        title="Setup"
        description="School profile, academic calendar and year group capacity."
      />
      {project ? (
        <Suspense fallback={null}>
          <SetupWizardWithStep projectId={project.id} />
        </Suspense>
      ) : null}
    </>
  )
}
