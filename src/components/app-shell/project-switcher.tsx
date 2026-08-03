'use client'

import { Check, ChevronsUpDown, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProjectStore } from '@/store/project-store'
import { formatDateTime } from '@/lib/format'

export function ProjectSwitcher() {
  const projects = useProjectStore((state) => state.projects)
  const activeProjectId = useProjectStore((state) => state.activeProjectId)
  const setActiveProject = useProjectStore((state) => state.setActiveProject)
  const createProject = useProjectStore((state) => state.createProject)

  const projectList = Object.values(projects).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
  const activeProject = activeProjectId ? projects[activeProjectId] : undefined

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="max-w-56 justify-between gap-2 font-normal">
            <span className="truncate">
              {activeProject?.meta.schoolName ?? 'No project selected'}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent className="min-w-72">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        {projectList.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No saved projects yet</p>
        ) : (
          projectList.map((project) => (
            <DropdownMenuItem key={project.id} onClick={() => setActiveProject(project.id)}>
              {project.id === activeProjectId ? (
                <Check className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate">{project.meta.schoolName}</span>
                <span className="text-xs text-muted-foreground">
                  Updated {formatDateTime(project.updatedAt)}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => createProject()}>
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
