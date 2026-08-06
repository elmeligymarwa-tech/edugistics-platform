'use client'

import { Plus, Trash2 } from 'lucide-react'

import { DataGrid, toNumberOrZero, type GridColumnDef, type GridRowGroup } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StaffSectionSchema, type Project, type StaffPosition } from '@/domain/schema'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'
import { createStaffPosition, useSyncDerivedPositions } from './use-sync-derived-positions'

const PERCENT_FIELDS = new Set<keyof StaffPosition>([
  'annualIncrementPct',
  'employerTaxPct',
  'nationalInsurancePct',
  'medicalInsurancePct',
  'pensionPct',
])

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
  { key: 'monthsWorked', label: 'Months worked' },
]

interface PositionRow {
  position: StaffPosition
  onUpdate: (patch: Partial<StaffPosition>) => void
  onRemove: () => void
}

/**
 * The full position editor grouped by staffing section, covering salary
 * bands, increments, on-costs, allowances, recruitment and training.
 * Teaching positions are derived from Capacity Planning unless overridden.
 * Shared by the setup wizard's staffing step and the Staffing & Payroll page.
 */
export function PositionEditor({ project }: { project: Project }) {
  const updateStaffing = useProjectStore((state) => state.updateStaffing)

  useSyncDerivedPositions(project)

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

  const rowGroups: GridRowGroup<PositionRow>[] = StaffSectionSchema.options
    .map((section): GridRowGroup<PositionRow> | null => {
      const positions = project.staffing.positions.filter((position) => position.section === section)
      if (positions.length === 0) return null
      return {
        id: section,
        label: STAFF_SECTION_LABELS[section] ?? section,
        rows: positions.map((position) => ({
          position,
          onUpdate: (patch: Partial<StaffPosition>) => updatePosition(position.id, patch),
          onRemove: () => removePosition(position.id),
        })),
      }
    })
    .filter((group): group is GridRowGroup<PositionRow> => group !== null)

  const columns: GridColumnDef<PositionRow>[] = [
    {
      id: 'title',
      label: 'Position',
      kind: 'text',
      width: 220,
      minWidth: 180,
      pinned: 'left',
      getValue: (row) => row.position.title,
      onCommit: (row, value) => row.onUpdate({ title: typeof value === 'string' ? value : '' }),
      render: (row) => {
        const { position } = row
        return (
          <div className="flex w-full items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate">{position.title}</span>
            {position.derivedFromCapacity ? (
              <button
                type="button"
                onClick={() => row.onUpdate({ manualOverride: !position.manualOverride })}
                title={position.manualOverride ? 'Manually overridden headcount' : 'Headcount derived from capacity'}
                className={cn(
                  'shrink-0 rounded px-1 text-[0.65rem] font-medium',
                  position.manualOverride ? 'bg-warning/20 text-warning-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {position.manualOverride ? 'Override' : 'Auto'}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Remove ${position.title}`}
                onClick={row.onRemove}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )
      },
    },
    {
      id: 'headcount',
      label: 'Headcount',
      kind: 'numeric',
      width: 104,
      minWidth: 96,
      disabled: (row) => row.position.derivedFromCapacity && !row.position.manualOverride,
      getValue: (row) => row.position.headcount,
      onCommit: (row, value) => row.onUpdate({ headcount: toNumberOrZero(value) }),
    },
    ...NUMBER_FIELDS.map(
      ({ key, label }): GridColumnDef<PositionRow> => ({
        id: key,
        label,
        kind: PERCENT_FIELDS.has(key) ? 'percent' : 'numeric',
        width: 128,
        minWidth: 108,
        allowFillDown: true,
        allowUplift: key !== 'monthsWorked',
        getValue: (row) => row.position[key] as number,
        onCommit: (row, value) =>
          row.onUpdate({
            [key]: key === 'monthsWorked' ? Math.min(12, Math.max(1, toNumberOrZero(value))) : toNumberOrZero(value),
          } as Partial<StaffPosition>),
      }),
    ),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {StaffSectionSchema.options.map((section) => (
          <Button key={section} type="button" size="sm" variant="outline" onClick={() => addPosition(section)}>
            <Plus data-icon="inline-start" />
            {STAFF_SECTION_LABELS[section] ?? section}
          </Button>
        ))}
      </div>
      {rowGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No positions yet.</p>
      ) : (
        <DataGrid
          rows={rowGroups}
          getRowId={(row) => row.position.id}
          columns={columns}
          mode="edit"
          gridId="staffing-positions"
          ariaLabel="Staff positions"
        />
      )}
    </div>
  )
}
