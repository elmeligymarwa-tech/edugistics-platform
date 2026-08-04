'use client'

import { useEffect } from 'react'

import { PageHeader } from '@/components/app-shell/page-header'
import { useActiveProject, useHasHydrated, useProjectStore } from '@/store/project-store'
import { SetupWizard } from './wizard'

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
      {project ? <SetupWizard projectId={project.id} /> : null}
    </>
  )
}
