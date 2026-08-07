'use client'

import { useState } from 'react'
import { Copy, Layers, Plus, Trash2 } from 'lucide-react'

import {
  COLUMN_WIDTH,
  DataGrid,
  coerceCellValue,
  toNumberOrZero,
  type CellPatch,
  type GridColumnDef,
  type GridColumnGroup,
  type GridRowGroup,
} from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { orderedYearGroups, StaffSectionSchema, type Project, type StaffPosition, type YearGroupId } from '@/domain/schema'
import { formatMoney, formatNumber } from '@/lib/format'
import { STAFF_SECTION_LABELS, YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { useProjectCostForecast, useProjectStore } from '@/store/project-store'
import { createStaffPosition } from './create-staff-position'

const PERCENT_FIELDS = new Set<keyof StaffPosition>(['annualIncrementPct', 'employerTaxPct', 'nationalInsurancePct'])

const MONEY_FIELDS = new Set<keyof StaffPosition>(['averageSalary'])

/** A year sub-column of the Total cost group — narrower than a plain money column since a forecast can run to ten of them. */
const YEAR_COLUMN_WIDTH = { width: 112, minWidth: 96 }

/** Pre-filled role suffix per section when bulk-adding by year group, e.g. "FS1 Teacher". Every section can still be typed over. */
const DEFAULT_BULK_ADD_ROLE: Record<StaffPosition['section'], string> = {
  leadership: '',
  teaching: 'Teacher',
  studentServices: '',
  administration: '',
  facilities: '',
}

/** "EYFS 1 Teacher" -> "EYFS 1 Teacher 2"; duplicating that again -> "EYFS 1 Teacher 3", skipping any suffix already taken. */
function nextDuplicateTitle(existingTitles: string[], title: string): string {
  const match = /^(.*) (\d+)$/.exec(title)
  const root = match ? match[1]! : title
  const taken = new Set(existingTitles)
  let suffix = match ? Number(match[2]) + 1 : 2
  while (taken.has(`${root} ${suffix}`)) suffix += 1
  return `${root} ${suffix}`
}

type StaffingRow =
  | {
      kind: 'position'
      position: StaffPosition
      onUpdate: (patch: Partial<StaffPosition>) => void
      onRemove: () => void
      onDuplicate: () => void
    }
  | { kind: 'summary'; id: string; label: string; headcount: number; totalCostByYear: number[] }

/**
 * The full position editor grouped by staffing section, covering headcount,
 * salary bands, increments, on-costs, allowances, recruitment and training.
 * Every row — including Teachers, Teaching Assistants and Co-Teachers — is a
 * plain typed row: renameable, deletable, duplicable. Shared by the setup
 * wizard's staffing step and the Staffing & Payroll page.
 */
export function PositionEditor({ project }: { project: Project }) {
  const updateStaffing = useProjectStore((state) => state.updateStaffing)
  const costForecast = useProjectCostForecast(project.id)

  const forecastYears = project.calendar.forecastYears
  const payrollYears = costForecast?.payroll ?? []

  /** A position's full cost — salary, allowances, on-costs, recruitment, training — for each forecast year, with the annual increase already compounded in by computeCostForecast. */
  const totalCostByYearForPosition = (positionId: string): number[] =>
    Array.from({ length: forecastYears }, (_, y) => payrollYears[y]?.lines.find((line) => line.positionId === positionId)?.total ?? 0)

  const totalCostByYearForPositions = (positions: StaffPosition[]): number[] =>
    Array.from({ length: forecastYears }, (_, y) =>
      positions.reduce((sum, position) => sum + (payrollYears[y]?.lines.find((line) => line.positionId === position.id)?.total ?? 0), 0),
    )

  const totalCostByYearFor = (row: StaffingRow): number[] =>
    row.kind === 'position' ? totalCostByYearForPosition(row.position.id) : row.totalCostByYear

  const numberFields: Array<{
    key: keyof StaffPosition
    label: string
    tooltip?: string
    editHint?: (row: StaffingRow, draft: string) => React.ReactNode
  }> = [
    {
      key: 'averageSalary',
      label: 'Expected monthly salary',
      tooltip: 'Gross monthly salary per person.',
      editHint: (row, draft) => {
        if (row.kind !== 'position') return null
        const monthly = toNumberOrZero(coerceCellValue('numeric', draft))
        const months = row.position.monthsWorked
        const annual = monthly * months
        return `${formatNumber(monthly, project.meta.locale)} a month over ${formatNumber(months, project.meta.locale)} months equals ${formatMoney(annual, project.meta).text} a year`
      },
    },
    { key: 'annualIncrementPct', label: 'Annual increase %' },
    { key: 'employerTaxPct', label: 'Employer tax %' },
    { key: 'nationalInsurancePct', label: 'National insurance %' },
    { key: 'monthsWorked', label: 'Contract months' },
  ]

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

  const duplicatePosition = (id: string) => {
    const index = project.staffing.positions.findIndex((position) => position.id === id)
    if (index === -1) return
    const original = project.staffing.positions[index]!
    const copy: StaffPosition = {
      ...original,
      id: globalThis.crypto.randomUUID(),
      title: nextDuplicateTitle(project.staffing.positions.map((position) => position.title), original.title),
    }
    updateStaffing(project.id, {
      positions: [
        ...project.staffing.positions.slice(0, index + 1),
        copy,
        ...project.staffing.positions.slice(index + 1),
      ],
    })
  }

  const addPosition = (section: StaffPosition['section']) => {
    updateStaffing(project.id, {
      positions: [...project.staffing.positions, createStaffPosition({ title: 'New position', section })],
    })
  }

  const addPositions = (newPositions: StaffPosition[]) => {
    if (newPositions.length === 0) return
    updateStaffing(project.id, { positions: [...project.staffing.positions, ...newPositions] })
  }

  const handlePasteRange = (patches: CellPatch<StaffingRow>[]) => {
    let positions = project.staffing.positions
    for (const patch of patches) {
      if (patch.row.kind !== 'position') continue
      const id = patch.row.position.id
      positions = positions.map((position) => {
        if (position.id !== id) return position
        if (patch.columnId === 'title') {
          return { ...position, title: typeof patch.value === 'string' ? patch.value : position.title }
        }
        if (patch.columnId === 'headcount') {
          return { ...position, headcount: toNumberOrZero(patch.value) }
        }
        const field = numberFields.find(({ key }) => key === patch.columnId)
        if (!field) return position
        const numeric =
          field.key === 'monthsWorked'
            ? Math.min(12, Math.max(1, toNumberOrZero(patch.value)))
            : toNumberOrZero(patch.value)
        return { ...position, [field.key]: numeric }
      })
    }
    updateStaffing(project.id, { positions })
  }

  const rowGroups: GridRowGroup<StaffingRow>[] = StaffSectionSchema.options
    .map((section): GridRowGroup<StaffingRow> | null => {
      const sectionPositions = project.staffing.positions.filter((position) => position.section === section)
      if (sectionPositions.length === 0) return null
      const rows: StaffingRow[] = sectionPositions.map((position) => ({
        kind: 'position',
        position,
        onUpdate: (patch: Partial<StaffPosition>) => updatePosition(position.id, patch),
        onRemove: () => removePosition(position.id),
        onDuplicate: () => duplicatePosition(position.id),
      }))
      rows.push({
        kind: 'summary',
        id: `subtotal-${section}`,
        label: 'Subtotal',
        headcount: sectionPositions.reduce((sum, position) => sum + position.headcount, 0),
        totalCostByYear: totalCostByYearForPositions(sectionPositions),
      })
      return { id: section, label: STAFF_SECTION_LABELS[section] ?? section, rows }
    })
    .filter((group): group is GridRowGroup<StaffingRow> => group !== null)

  if (project.staffing.positions.length > 0) {
    rowGroups.push({
      id: 'grand-total',
      label: 'Grand total',
      rows: [
        {
          kind: 'summary',
          id: 'grand-total',
          label: 'Grand total',
          headcount: project.staffing.positions.reduce((sum, position) => sum + position.headcount, 0),
          totalCostByYear: totalCostByYearForPositions(project.staffing.positions),
        },
      ],
    })
  }

  // Essential (always shown) columns: Position, Headcount, the five numberFields columns and
  // the Total cost group's own Total column — everything except its per-year sub-columns.
  const essentialColumnsWidth =
    COLUMN_WIDTH.label.width +
    COLUMN_WIDTH.count.width +
    COLUMN_WIDTH.money.width +
    COLUMN_WIDTH.percent.width * 3 +
    COLUMN_WIDTH.count.width +
    COLUMN_WIDTH.money.width
  const yearColumnsFitAt1280 = essentialColumnsWidth + forecastYears * YEAR_COLUMN_WIDTH.width <= 1280

  const totalCostGroup: GridColumnGroup<StaffingRow> = {
    id: 'totalCost',
    label: 'Total cost',
    columns: [
      ...Array.from({ length: forecastYears }, (_, yearIndex): GridColumnDef<StaffingRow> => ({
        id: `totalCost-year-${yearIndex}`,
        label: `Year ${yearIndex + 1}`,
        kind: 'readonly',
        width: YEAR_COLUMN_WIDTH.width,
        minWidth: YEAR_COLUMN_WIDTH.minWidth,
        // Hidden behind "Show more columns" whenever the full set of year sub-columns
        // wouldn't fit alongside the essential columns at a 1280px viewport.
        secondary: !yearColumnsFitAt1280,
        getValue: (row) => totalCostByYearFor(row)[yearIndex] ?? 0,
        format: (value) => (typeof value === 'number' ? formatMoney(value, project.meta) : ''),
      })),
      {
        id: 'totalCost-total',
        label: 'Total',
        tooltip: 'Sum of this cost across the whole forecast.',
        kind: 'readonly',
        ...COLUMN_WIDTH.money,
        getValue: (row) => totalCostByYearFor(row).reduce((sum, value) => sum + value, 0),
        format: (value) => (typeof value === 'number' ? formatMoney(value, project.meta) : ''),
      },
    ],
  }

  const columns: (GridColumnDef<StaffingRow> | GridColumnGroup<StaffingRow>)[] = [
    {
      id: 'title',
      label: 'Position',
      kind: 'text',
      ...COLUMN_WIDTH.label,
      pinned: 'left',
      disabled: (row) => row.kind !== 'position',
      getValue: (row) => (row.kind === 'position' ? row.position.title : row.label),
      onCommit: (row, value) => {
        if (row.kind !== 'position') return
        row.onUpdate({ title: typeof value === 'string' ? value : '' })
      },
      render: (row) => {
        if (row.kind !== 'position') {
          return <span className="truncate">{row.label}</span>
        }
        const { position } = row
        return (
          <div className="flex w-full items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate">{position.title}</span>
            <button
              type="button"
              aria-label={`Duplicate ${position.title}`}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={row.onDuplicate}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${position.title}`}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={row.onRemove}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )
      },
    },
    {
      id: 'headcount',
      label: 'Headcount',
      kind: 'numeric',
      ...COLUMN_WIDTH.count,
      allowFillDown: true,
      disabled: (row) => row.kind !== 'position',
      getValue: (row) => (row.kind === 'position' ? row.position.headcount : row.headcount),
      onCommit: (row, value) => {
        if (row.kind !== 'position') return
        row.onUpdate({ headcount: toNumberOrZero(value) })
      },
    },
    ...numberFields.map(
      ({ key, label, tooltip, editHint }): GridColumnDef<StaffingRow> => ({
        id: key,
        label,
        tooltip,
        kind: PERCENT_FIELDS.has(key) ? 'percent' : 'numeric',
        ...(PERCENT_FIELDS.has(key) ? COLUMN_WIDTH.percent : MONEY_FIELDS.has(key) ? COLUMN_WIDTH.money : COLUMN_WIDTH.count),
        // Staffing uses an increment/decrement stepper for every percent field, not the
        // slider popover other percent-kind grids (fees, loans, opex) still use.
        stepper: PERCENT_FIELDS.has(key),
        allowFillDown: true,
        allowUplift: key !== 'monthsWorked',
        disabled: (row) => row.kind !== 'position',
        getValue: (row) => (row.kind === 'position' ? (row.position[key] as number) : null),
        onCommit: (row, value) => {
          if (row.kind !== 'position') return
          row.onUpdate({
            [key]: key === 'monthsWorked' ? Math.min(12, Math.max(1, toNumberOrZero(value))) : toNumberOrZero(value),
          } as Partial<StaffPosition>)
        },
        editHint,
      }),
    ),
    totalCostGroup,
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
          getRowId={(row) => (row.kind === 'position' ? row.position.id : row.id)}
          columns={columns}
          mode="edit"
          gridId="staffing-positions"
          ariaLabel="Staff positions"
          getRowClassName={(row) => (row.kind !== 'position' ? 'font-semibold bg-muted/40' : undefined)}
          onPasteRange={handlePasteRange}
          renderGroupHeaderAction={(groupId) =>
            groupId === 'grand-total' ? null : (
              <BulkAddControl project={project} section={groupId as StaffPosition['section']} onAdd={addPositions} />
            )
          }
        />
      )}
    </div>
  )
}

function BulkAddControl({
  project,
  section,
  onAdd,
}: {
  project: Project
  section: StaffPosition['section']
  onAdd: (positions: StaffPosition[]) => void
}) {
  const groups = orderedYearGroups(project)
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(DEFAULT_BULK_ADD_ROLE[section])
  const [selected, setSelected] = useState<Set<YearGroupId>>(new Set())

  if (groups.length === 0) return null

  const toggleGroup = (group: YearGroupId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const handleAdd = () => {
    if (selected.size === 0) return
    const positions = groups
      .filter((group) => selected.has(group))
      .map((group) => createStaffPosition({ title: `${YEAR_GROUP_LABELS[group]} ${role}`.trim(), section }))
    onAdd(positions)
    setSelected(new Set())
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setRole(DEFAULT_BULK_ADD_ROLE[section])
      }}
    >
      <PopoverTrigger
        aria-label={`Bulk add positions to ${STAFF_SECTION_LABELS[section] ?? section}`}
        className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Layers className="size-3.5" />
        Bulk add
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor={`bulk-add-role-${section}`}>Role suffix</FieldLabel>
            <Input
              id={`bulk-add-role-${section}`}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. Teacher"
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((group) => {
              const isSelected = selected.has(group)
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/30',
                  )}
                >
                  {YEAR_GROUP_LABELS[group]}
                </button>
              )
            })}
          </div>
          <Button type="button" size="sm" onClick={handleAdd} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `${selected.size} ` : ''}position{selected.size === 1 ? '' : 's'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
