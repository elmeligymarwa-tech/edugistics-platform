'use client'

import { PositionEditor } from '@/components/staffing/position-editor'
import type { Project } from '@/domain/schema'

export function Step6Staffing({ project }: { project: Project }) {
  return <PositionEditor project={project} />
}
