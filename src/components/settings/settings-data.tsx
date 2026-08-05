'use client'

import { useRef, useState } from 'react'
import { Download, Pencil, Trash2, Upload } from 'lucide-react'

import { DeleteProjectDialog, RenameProjectDialog } from '@/components/app-shell/project-dialogs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import { downloadJson } from '@/lib/download'
import { formatImportErrors } from '@/lib/import-errors'
import { useProjectStore } from '@/store/project-store'

export function SettingsData({ project }: { project: Project }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportProject = useProjectStore((state) => state.exportProject)
  const importProject = useProjectStore((state) => state.importProject)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [importedName, setImportedName] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleExport() {
    const json = exportProject(project.id)
    downloadJson(`${project.meta.schoolName}.json`, json)
  }

  async function handleFileSelected(file: File) {
    setErrors(null)
    setImportedName(null)
    const text = await file.text()
    const result = importProject(text)
    if (!result.ok) {
      setErrors(formatImportErrors(result.error))
      return
    }
    const imported = useProjectStore.getState().projects[result.id]
    setImportedName(imported?.meta.schoolName ?? 'Project')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-sm text-muted-foreground">
          Export the active project and its cost model as a file, or import a previously exported file
          as a new project.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download data-icon="inline-start" />
            Export project
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload data-icon="inline-start" />
            Import project
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
            <Pencil data-icon="inline-start" />
            Rename project
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 data-icon="inline-start" />
            Delete project
          </Button>
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
        </div>
        {importedName ? (
          <p className="text-sm text-muted-foreground">
            Imported &lsquo;{importedName}&rsquo; as a new project and switched to it.
          </p>
        ) : null}
        {errors ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">Could not import project</p>
            <ul className="mt-1 list-disc pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
      <RenameProjectDialog
        project={renameOpen ? project : null}
        onOpenChange={(open) => setRenameOpen(open)}
      />
      <DeleteProjectDialog
        project={deleteOpen ? project : null}
        onOpenChange={(open) => setDeleteOpen(open)}
      />
    </Card>
  )
}
