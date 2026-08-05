'use client'

import { useRef, useState } from 'react'
import { Check, ChevronsUpDown, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProjectStore } from '@/store/project-store'
import { downloadJson } from '@/lib/download'
import { formatDateTime } from '@/lib/format'
import { formatImportErrors } from '@/lib/import-errors'
import type { Project } from '@/domain/schema'
import { DeleteProjectDialog, RenameProjectDialog } from './project-dialogs'

export function ProjectSwitcher() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projects = useProjectStore((state) => state.projects)
  const activeProjectId = useProjectStore((state) => state.activeProjectId)
  const setActiveProject = useProjectStore((state) => state.setActiveProject)
  const createProject = useProjectStore((state) => state.createProject)
  const exportProject = useProjectStore((state) => state.exportProject)
  const importProject = useProjectStore((state) => state.importProject)
  const [importErrors, setImportErrors] = useState<string[] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const projectList = Object.values(projects).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
  const activeProject = activeProjectId ? projects[activeProjectId] : undefined

  function handleExport() {
    if (!activeProject) return
    const json = exportProject(activeProject.id)
    downloadJson(`${activeProject.meta.schoolName}.json`, json)
  }

  async function handleFileSelected(file: File) {
    const text = await file.text()
    const result = importProject(text)
    if (!result.ok) {
      setImportErrors(formatImportErrors(result.error))
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
            <div className="flex flex-col gap-0.5">
              {projectList.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-0.5 rounded-md hover:bg-muted"
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => {
                      setActiveProject(project.id)
                      setMenuOpen(false)
                    }}
                  >
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
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${project.meta.schoolName}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setMenuOpen(false)
                      setRenameTarget(project)
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${project.meta.schoolName}`}
                    className="mr-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setMenuOpen(false)
                      setDeleteTarget(project)
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => createProject()}>
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            New project
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!activeProject} onClick={handleExport}>
            <Download className="size-4 shrink-0" aria-hidden="true" />
            Export project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4 shrink-0" aria-hidden="true" />
            Import project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void handleFileSelected(file)
        }}
      />
      <Dialog open={importErrors !== null} onOpenChange={(open) => !open && setImportErrors(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Could not import project</DialogTitle>
          </DialogHeader>
          <ul className="list-disc pl-4 text-sm text-destructive">
            {importErrors?.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </DialogContent>
      </Dialog>
      <RenameProjectDialog
        project={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      />
      <DeleteProjectDialog
        project={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </>
  )
}
