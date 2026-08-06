'use client'

import { useState } from 'react'
import { Save, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Project } from '@/domain/schema'
import { applyPreset, captureProjectAsPreset } from '@/lib/presets/apply-preset'
import { useAllPresets, usePresetStore } from '@/store/preset-store'
import { useProjectStore } from '@/store/project-store'

/**
 * Apply a starting-point preset to the current project, or save the current
 * setup as a named preset to reuse on a future project. Every value a
 * preset writes stays fully editable afterwards — this only ever adds via
 * the same store actions the grids use.
 */
export function PresetPanel({ project }: { project: Project }) {
  const presets = useAllPresets()
  const savePreset = usePresetStore((state) => state.savePreset)
  const costModel = useProjectStore((state) => state.costModels[project.id])

  const [selectedPresetId, setSelectedPresetId] = useState(presets[0]?.id ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null)

  const handleApply = () => {
    const preset = presets.find((entry) => entry.id === selectedPresetId)
    if (!preset) return
    applyPreset(preset, project)
    setAppliedMessage(`Applied “${preset.name}”. Every field it filled in stays editable below.`)
  }

  const handleSave = () => {
    const name = saveName.trim()
    if (!name) return
    savePreset(name, captureProjectAsPreset(project, costModel ?? null))
    setSaveName('')
    setIsSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Presets</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-56 flex-1">
            <FieldLabel htmlFor="presetSelect">Apply a starting point</FieldLabel>
            <Select
              id="presetSelect"
              value={selectedPresetId}
              items={presets.map((preset) => ({ value: preset.id, label: preset.name }))}
              onValueChange={setSelectedPresetId}
            />
          </Field>
          <Button type="button" onClick={handleApply} disabled={!selectedPresetId}>
            <Sparkles data-icon="inline-start" />
            Apply preset
          </Button>
          {!isSaving ? (
            <Button type="button" variant="outline" onClick={() => setIsSaving(true)}>
              <Save data-icon="inline-start" />
              Save current setup as preset
            </Button>
          ) : (
            <div className="flex items-end gap-2">
              <Field className="w-56">
                <FieldLabel htmlFor="presetName">Preset name</FieldLabel>
                <Input
                  id="presetName"
                  autoFocus
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  placeholder="e.g. Standard UK curriculum"
                />
              </Field>
              <Button type="button" size="sm" onClick={handleSave} disabled={!saveName.trim()}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setIsSaving(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
        {appliedMessage ? <p className="text-xs text-muted-foreground">{appliedMessage}</p> : null}
        {presets.find((preset) => preset.id === selectedPresetId)?.description ? (
          <p className="text-xs text-muted-foreground">
            {presets.find((preset) => preset.id === selectedPresetId)?.description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
