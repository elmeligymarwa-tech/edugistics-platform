'use client'

import { useEffect } from 'react'

import { PageHeader } from '@/components/app-shell/page-header'
import { useActiveProject, useProjectStore } from '@/store/project-store'
import { SetupWizard } from './wizard'

export default function SetupPage() {
  const project = useActiveProject()
  const createProject = useProjectStore((state) => state.createProject)

  useEffect(() => {
    if (!project) createProject()
  }, [project, createProject])

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
