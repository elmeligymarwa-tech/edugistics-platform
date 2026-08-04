'use client'

import { useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { StaffSectionSchema, orderedYearGroups, type Project, type StaffPosition } from '@/domain/schema'
import { useProjectStore } from '@/store/project-store'

const SECTION_LABELS: Record<string, string> = {
  leadership: 'Leadership',
  teaching: 'Teaching',
  studentServices: 'Student services',
  administration: 'Administration',
  facilities: 'Facilities',
}

const DERIVED_POSITIONS: Array<{
  id: string
  title: string
  field: 'teachers' | 'teachingAssistants' | 'coTeachers'
}> = [
  { id: 'derived-teachers', title: 'Teachers', field: 'teachers' },
  { id: 'derived-teaching-assistants', title: 'Teaching Assistants', field: 'teachingAssistants' },
  { id: 'derived-co-teachers', title: 'Co-Teachers', field: 'coTeachers' },
]

const NUMBER_FIELDS: Array<{ key: keyof StaffPosition; label: string }> = [
  { key: 'averageSalary', label: 'Average salary' },
  { key: 'minimumSalary', label: 'Minimum salary' },
  { key: 'maximumSalary', label: 'Maximum salary' },
  { key: 'annualIncrementPct', label: 'Annual increment %' },
  { key: 'employerTaxPct', label: 'Employer tax %' },
  { key: 'nationalInsurancePct', label: 'National insurance %' },
  { key: 'medicalInsurancePct', label: 'Medical insurance %' },
  { key: 'pensionPct', label: 'Pension %' },
  { key: 'housingAllowance', label: 'Housing allowance' },
  { key: 'transportAllowance', label: 'Transport allowance' },
  { key: 'recruitmentCost', label: 'Recruitment cost' },
  { key: 'trainingCost', label: 'Training cost' },
]

function createStaffPosition(
  overrides: Partial<StaffPosition> & { title: string; section: StaffPosition['section'] },
): StaffPosition {
  return {
    id: overrides.id ?? globalThis.crypto.randomUUID(),
    title: overrides.title,
    section: overrides.section,
    derivedFromCapacity: overrides.derivedFromCapacity ?? false,
    manualOverride: overrides.manualOverride ?? false,
    headcount: overrides.headcount ?? 0,
    averageSalary: overrides.averageSalary ?? 0,
    minimumSalary: overrides.minimumSalary ?? 0,
    maximumSalary: overrides.maximumSalary ?? 0,
    annualIncrementPct: overrides.annualIncrementPct ?? 0,
    employerTaxPct: overrides.employerTaxPct ?? 0,
    nationalInsurancePct: overrides.nationalInsurancePct ?? 0,
    medicalInsurancePct: overrides.medicalInsurancePct ?? 0,
    pensionPct: overrides.pensionPct ?? 0,
    housingAllowance: overrides.housingAllowance ?? 0,
    transportAllowance: overrides.transportAllowance ?? 0,
    recruitmentCost: overrides.recruitmentCost ?? 0,
    trainingCost: overrides.trainingCost ?? 0,
  }
}

export function Step6Staffing({ project }: { project: Project }) {
  const updateStaffing = useProjectStore((state) => state.updateStaffing)

  const positionSignature = project.staffing.positions
    .map((position) => `${position.id}:${position.manualOverride}`)
    .join(',')

  useEffect(() => {
    const groups = orderedYearGroups(project)
    const sums: Record<string, number> = {
      teachers: groups.reduce((sum, group) => sum + (project.capacity[group]?.teachers ?? 0), 0),
      teachingAssistants: groups.reduce(
        (sum, group) => sum + (project.capacity[group]?.teachingAssistants ?? 0),
        0,
      ),
      coTeachers: groups.reduce((sum, group) => sum + (project.capacity[group]?.coTeachers ?? 0), 0),
    }

    let positions = project.staffing.positions
    let changed = false

    for (const derived of DERIVED_POSITIONS) {
      const target = sums[derived.field] ?? 0
      const existing = positions.find((position) => position.id === derived.id)
      if (!existing) {
        positions = [
          ...positions,
          createStaffPosition({
            id: derived.id,
            title: derived.title,
            section: 'teaching',
            derivedFromCapacity: true,
            headcount: target,
          }),
        ]
        changed = true
      } else if (!existing.manualOverride && existing.headcount !== target) {
        positions = positions.map((position) =>
          position.id === derived.id ? { ...position, headcount: target } : position,
        )
        changed = true
      }
    }

    if (changed) updateStaffing(project.id, { positions })
    // Re-runs only when capacity, the selected year groups, or override flags change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, JSON.stringify(project.capacity), project.yearGroups.join(','), positionSignature])

  const updatePosition = (id: string, patch: Partial<StaffPosition>) => {
    updateStaffing(project.id, {
      positions: project.staffing.positions.map((position) =>
        position.id === id ? { ...position, ...patch } : position,
      ),
    })
  }

  const removePosition = (id: string) => {
    updateStaffing(project.id, {
      positions: project.staffing.positions.filter((position) => position.id !== id),
    })
  }

  const addPosition = (section: StaffPosition['section']) => {
    updateStaffing(project.id, {
      positions: [...project.staffing.positions, createStaffPosition({ title: 'New position', section })],
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {StaffSectionSchema.options.map((section) => {
        const positions = project.staffing.positions.filter((position) => position.section === section)
        return (
          <div key={section} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {SECTION_LABELS[section] ?? section}
              </h3>
              <Button type="button" size="sm" variant="outline" onClick={() => addPosition(section)}>
                <Plus data-icon="inline-start" />
                Add position
              </Button>
            </div>
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No positions yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {positions.map((position) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    onUpdate={(patch) => updatePosition(position.id, patch)}
                    onRemove={() => removePosition(position.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PositionCard({
  position,
  onUpdate,
  onRemove,
}: {
  position: StaffPosition
  onUpdate: (patch: Partial<StaffPosition>) => void
  onRemove: () => void
}) {
  const isDerivedLocked = position.derivedFromCapacity && !position.manualOverride

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            className="h-7 w-48"
            value={position.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
          {position.derivedFromCapacity && position.manualOverride ? (
            <Badge variant="warning">Overridden</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {position.derivedFromCapacity ? (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch
                checked={position.manualOverride}
                onCheckedChange={(checked) => onUpdate({ manualOverride: checked })}
              />
              Override headcount
            </label>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${position.title}`}
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-4 lg:grid-cols-6">
        <Field>
          <FieldLabel htmlFor={`${position.id}-headcount`}>Headcount</FieldLabel>
          <Input
            id={`${position.id}-headcount`}
            type="number"
            min={0}
            disabled={isDerivedLocked}
            value={position.headcount}
            onChange={(event) => onUpdate({ headcount: Number(event.target.value) })}
          />
        </Field>
        {NUMBER_FIELDS.map((field) => (
          <Field key={field.key}>
            <FieldLabel htmlFor={`${position.id}-${field.key}`}>{field.label}</FieldLabel>
            <Input
              id={`${position.id}-${field.key}`}
              type="number"
              min={0}
              value={position[field.key] as number}
              onChange={(event) =>
                onUpdate({ [field.key]: Number(event.target.value) } as Partial<StaffPosition>)
              }
            />
          </Field>
        ))}
      </CardContent>
    </Card>
  )
}
