'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Project } from '@/domain/schema'
import { useProjectStore } from '@/store/project-store'

export function RenameProjectDialog({
  project,
  onOpenChange,
}: {
  project: Project | null
  onOpenChange: (open: boolean) => void
}) {
  const renameProject = useProjectStore((state) => state.renameProject)
  const [name, setName] = useState('')

  useEffect(() => {
    if (project) setName(project.meta.schoolName)
  }, [project])

  function handleSubmit() {
    if (!project) return
    const trimmed = name.trim()
    if (!trimmed) return
    renameProject(project.id, trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={project !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteProjectDialog({
  project,
  onOpenChange,
}: {
  project: Project | null
  onOpenChange: (open: boolean) => void
}) {
  const deleteProject = useProjectStore((state) => state.deleteProject)

  function handleDelete() {
    if (!project) return
    deleteProject(project.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={project !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Delete &lsquo;{project?.meta.schoolName}&rsquo;? This cannot be undone and will remove all of its
          revenue, cost and scenario data.
        </DialogDescription>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete}>
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
