'use client'

import { useEffect, useState } from 'react'

import { COLUMN_WIDTH, DataGrid, toNumberOrZero, type GridColumnDef, type GridColumnGroup } from '@/components/grid'
import { GlossaryHint } from '@/components/glossary/glossary-hint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import { Switch } from '@/components/ui/switch'
import { orderedYearGroups, type Project, type SchoolPlan, type YearGroupCapacity, type YearGroupId } from '@/domain/schema'
import { computeEnrolment, type YearGroupEnrolment } from '@/engine/revenue'
import { formatNumber } from '@/lib/format'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/project-store'

/** Physical room capacity — classrooms times max students per class. Every other
 * capacity control (Max capacity %, the separate Max students override) has been
 * folded into this, on load, by the store's project migration. */
function capacityFor(capacity: YearGroupCapacity | undefined): number {
  return (capacity?.classrooms ?? 0) * (capacity?.studentsPerClassroom ?? 0)
}

/** Mirrors the engine's own array-bounds clamp so a ramp shorter than the current
 * forecast horizon still reads as "holds its last value", exactly as computeEnrolment sees it. */
function occupancyAtYear(occupancyPctByYear: number[], yearIndex: number): number {
  if (occupancyPctByYear.length === 0) return 0
  return occupancyPctByYear[Math.min(yearIndex, occupancyPctByYear.length - 1)] ?? 0
}

function intakeFromOccupancy(occupancyPct: number, capacity: number): number {
  return Math.round((occupancyPct / 100) * capacity)
}

function occupancyFromIntake(intake: number, capacity: number): number {
  if (capacity <= 0) return 0
  return Math.min(100, Math.max(0, (intake / capacity) * 100))
}

export function Step3Capacity({ project }: { project: Project }) {
  const updateCapacity = useProjectStore((state) => state.updateCapacity)
  const groups = orderedYearGroups(project)
  const forecastYears = project.calendar.forecastYears
  const groupsKey = groups.join(',')

  useEffect(() => {
    for (const group of groups) {
      const existing = project.capacity[group]
      if (!existing || existing.occupancyPctByYear.length === 0) {
        updateCapacity(project.id, group, {
          occupancyPctByYear: Array.from({ length: forecastYears }, () => 0),
        })
      }
    }
    // Re-runs only when the selected groups or the forecast horizon change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, groupsKey, forecastYears])

  const plan = project.revenueAssumptions.schoolPlan
  const enrolment = computeEnrolment(project)
  const yearOne = enrolment[0] ?? []
  const finalYear = enrolment[enrolment.length - 1] ?? []
  const ceilingByGroup = new Map(yearOne.map((entry) => [entry.yearGroup, entry.capacityCeiling]))

  const totalMax = groups.reduce((sum, group) => sum + (ceilingByGroup.get(group) ?? 0), 0)
  const totalYearOne = yearOne.reduce((sum, entry) => sum + entry.students, 0)
  const totalFinalYear = finalYear.reduce((sum, entry) => sum + entry.students, 0)
  const teachingHeadcount = project.staffing.positions
    .filter((position) => position.section === 'teaching')
    .reduce((sum, position) => sum + position.headcount, 0)
  const ratio = teachingHeadcount > 0 ? totalMax / teachingHeadcount : 0

  return (
    <div className="flex flex-col gap-4">
      <SchoolPlanPanel project={project} enrolment={enrolment} />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
          <SummaryStat label="Capacity" value={Math.round(totalMax).toLocaleString()} term="capacity-ceiling" />
          <SummaryStat label="Current intake, year 1" value={Math.round(totalYearOne).toLocaleString()} />
          <SummaryStat
            label={`Current intake, year ${forecastYears}`}
            value={Math.round(totalFinalYear).toLocaleString()}
          />
          <SummaryStat
            label="Student : teacher ratio"
            value={teachingHeadcount > 0 ? `${ratio.toFixed(1)} : 1` : '—'}
            term="student-teacher-ratio"
          />
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select at least one year group in the previous step to configure capacity.
        </p>
      ) : (
        <CapacityGrid
          project={project}
          groups={groups}
          planEnabled={plan.enabled}
          enrolment={enrolment}
        />
      )}
    </div>
  )
}

interface CapacityRow {
  group: YearGroupId
}

function CapacityGrid({
  project,
  groups,
  planEnabled,
  enrolment,
}: {
  project: Project
  groups: YearGroupId[]
  planEnabled: boolean
  enrolment: YearGroupEnrolment[][]
}) {
  const updateCapacity = useProjectStore((state) => state.updateCapacity)
  const forecastYears = project.calendar.forecastYears

  // Entered intakes above a row's capacity are still shown (and flagged coral) rather than
  // silently rewritten to the capacity figure, since what actually reaches the forecast is
  // already capped through occupancyPctByYear — this is display-only, for the current
  // session, keyed by "group-yearIndex".
  const [intakeOverrides, setIntakeOverrides] = useState<Record<string, number>>({})

  const rows: CapacityRow[] = groups.map((group) => ({ group }))

  const patch = (group: YearGroupId, values: Partial<Project['capacity'][string]>) =>
    updateCapacity(project.id, group, values)

  const numericColumn = (
    id: string,
    label: string,
    field: 'classrooms' | 'studentsPerClassroom',
    opts?: { secondary?: boolean; width?: number; minWidth?: number },
  ): GridColumnDef<CapacityRow> => ({
    id,
    label,
    kind: 'numeric',
    width: opts?.width ?? COLUMN_WIDTH.count.width,
    minWidth: opts?.minWidth ?? COLUMN_WIDTH.count.minWidth,
    allowFillDown: true,
    allowUplift: true,
    secondary: opts?.secondary,
    getValue: (row) => project.capacity[row.group]?.[field] ?? 0,
    onCommit: (row, value) => patch(row.group, { [field]: toNumberOrZero(value) }),
  })

  const columns: (GridColumnDef<CapacityRow> | GridColumnGroup<CapacityRow>)[] = [
    {
      id: 'group',
      label: 'Year group',
      kind: 'readonly',
      ...COLUMN_WIDTH.shortLabel,
      pinned: 'left',
      getValue: (row) => YEAR_GROUP_LABELS[row.group],
    },
    numericColumn('classrooms', 'Classrooms', 'classrooms'),
    numericColumn('studentsPerClassroom', 'Max students per class', 'studentsPerClassroom', { width: 108, minWidth: 90 }),
    {
      id: 'currentIntake',
      label: 'Current intake',
      collapsible: true,
      defaultCollapsed: false,
      // Narrower than COLUMN_WIDTH.count so up to ten forecast-year sub-columns (the
      // longest supported horizon) still fit alongside the rest of the essential columns
      // within a 1280px-wide viewport.
      columns: Array.from({ length: forecastYears }, (_, yearIndex): GridColumnDef<CapacityRow> => ({
        id: `currentIntake-${yearIndex}`,
        label: `Year ${yearIndex + 1}`,
        kind: planEnabled ? 'readonly' : 'numeric',
        width: 68,
        minWidth: 60,
        getValue: (row) => {
          if (planEnabled) return enrolment[yearIndex]?.find((e) => e.yearGroup === row.group)?.students ?? 0
          const override = intakeOverrides[`${row.group}-${yearIndex}`]
          if (override !== undefined) return override
          const capacity = project.capacity[row.group]
          return intakeFromOccupancy(occupancyAtYear(capacity?.occupancyPctByYear ?? [], yearIndex), capacityFor(capacity))
        },
        format: (value) => (typeof value === 'number' ? formatNumber(value, project.meta.locale) : ''),
        render: planEnabled
          ? undefined
          : (row) => {
              const capacity = project.capacity[row.group]
              const ceiling = capacityFor(capacity)
              const override = intakeOverrides[`${row.group}-${yearIndex}`]
              const value =
                override ??
                intakeFromOccupancy(occupancyAtYear(capacity?.occupancyPctByYear ?? [], yearIndex), ceiling)
              const exceeds = value > ceiling
              return (
                <span
                  className={cn('truncate tabular-nums', exceeds && 'font-semibold text-destructive')}
                  title={exceeds ? `Exceeds this row's capacity of ${formatNumber(ceiling, project.meta.locale)}` : undefined}
                >
                  {formatNumber(value, project.meta.locale)}
                </span>
              )
            },
        onCommit: planEnabled
          ? undefined
          : (row, value) => {
              const raw = typeof value === 'number' ? Math.max(0, Math.round(value)) : 0
              const capacity = project.capacity[row.group]
              const ceiling = capacityFor(capacity)
              const key = `${row.group}-${yearIndex}`

              setIntakeOverrides((prev) => {
                if (raw > ceiling) return { ...prev, [key]: raw }
                if (!(key in prev)) return prev
                const next = { ...prev }
                delete next[key]
                return next
              })

              const current = capacity?.occupancyPctByYear ?? []
              const nextOccupancy = [...current]
              while (nextOccupancy.length <= yearIndex) nextOccupancy.push(0)
              nextOccupancy[yearIndex] = occupancyFromIntake(raw, ceiling)
              patch(row.group, { occupancyPctByYear: nextOccupancy })
            },
      })),
    },
    {
      id: 'openFromYearIndex',
      label: 'Opens from year',
      kind: 'numeric',
      ...COLUMN_WIDTH.count,
      secondary: true,
      getValue: (row) => (project.capacity[row.group]?.openFromYearIndex ?? 0) + 1,
      onCommit: (row, value) => patch(row.group, { openFromYearIndex: Math.max(0, toNumberOrZero(value) - 1) }),
    },
    {
      id: 'capacity',
      label: 'Capacity',
      kind: 'readonly',
      ...COLUMN_WIDTH.readonly,
      getValue: (row) => capacityFor(project.capacity[row.group]),
      format: (value) => (typeof value === 'number' ? formatNumber(value, project.meta.locale) : ''),
    },
  ]

  return (
    <DataGrid
      rows={rows}
      getRowId={(row) => row.group}
      columns={columns}
      mode="edit"
      gridId="wizard-step3-capacity"
      ariaLabel="Year group capacity"
    />
  )
}

function SchoolPlanPanel({
  project,
  enrolment,
}: {
  project: Project
  enrolment: YearGroupEnrolment[][]
}) {
  const updateRevenueAssumptions = useProjectStore((state) => state.updateRevenueAssumptions)
  const forecastYears = project.calendar.forecastYears
  const groups = orderedYearGroups(project)
  const plan = project.revenueAssumptions.schoolPlan
  const [previewYearIndex, setPreviewYearIndex] = useState(0)

  const patchPlan = (patch: Partial<SchoolPlan>) =>
    updateRevenueAssumptions(project.id, { schoolPlan: { ...plan, ...patch } })

  const totalStudentsFor = (index: number) =>
    plan.totalStudentsByYear[index] ??
    plan.totalStudentsByYear[plan.totalStudentsByYear.length - 1] ??
    0

  const setTotalStudents = (index: number, value: number) => {
    const next = [...plan.totalStudentsByYear]
    while (next.length <= index) next.push(next[next.length - 1] ?? 0)
    next[index] = Math.max(0, value)
    patchPlan({ totalStudentsByYear: next })
  }

  const previewIndex = Math.min(previewYearIndex, forecastYears - 1, Math.max(0, enrolment.length - 1))
  const previewRow = enrolment[previewIndex] ?? []
  const previewTotal = previewRow.reduce((sum, entry) => sum + entry.students, 0)

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>School plan</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set the school total per year and let the model distribute students across year groups.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Switch checked={plan.enabled} onCheckedChange={(checked) => patchPlan({ enabled: checked })} />
          Plan top-down
        </label>
      </CardHeader>
      {plan.enabled ? (
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <Field className="w-40">
              <FieldLabel htmlFor="planMaxSchoolStudents">Maximum school students</FieldLabel>
              <Input
                id="planMaxSchoolStudents"
                type="number"
                min={0}
                placeholder="No limit"
                value={plan.maxSchoolStudents ?? ''}
                onChange={(event) => {
                  const raw = event.target.value
                  patchPlan({
                    maxSchoolStudents: raw === '' ? null : Math.max(0, Math.round(Number(raw))),
                  })
                }}
              />
            </Field>
          </div>

          <div>
            <FieldLabel>Total students per forecast year</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: forecastYears }, (_, index) => (
                <Field key={index} className="w-24">
                  <FieldLabel>Year {index + 1}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={totalStudentsFor(index)}
                    onChange={(event) => setTotalStudents(index, Number(event.target.value))}
                  />
                </Field>
              ))}
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="taperPct">Taper</FieldLabel>
            <SliderNumberField
              id="taperPct"
              aria-label="Taper %"
              min={0}
              max={100}
              step={1}
              suffix="%"
              value={plan.taperPct}
              onValueChange={(value) => patchPlan({ taperPct: value })}
            />
            <FieldDescription>
              Zero spreads intake evenly across year groups. One hundred puts all growth in the first
              year group and none in the last.
            </FieldDescription>
          </Field>

          {groups.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Live preview — allocated students</p>
                <div className="flex gap-1">
                  {Array.from({ length: forecastYears }, (_, index) => (
                    <Button
                      key={index}
                      type="button"
                      size="xs"
                      variant={previewIndex === index ? 'default' : 'outline'}
                      onClick={() => setPreviewYearIndex(index)}
                    >
                      Year {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {groups.map((group) => {
                  const entry = previewRow.find((row) => row.yearGroup === group)
                  const students = entry?.students ?? 0
                  const ceiling = entry?.capacityCeiling ?? 0
                  const width = previewTotal > 0 ? (students / previewTotal) * 100 : 0
                  return (
                    <div key={group} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0 font-medium text-foreground">
                        {YEAR_GROUP_LABELS[group]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-muted-foreground">
                        {Math.round(students).toLocaleString()} / {Math.round(ceiling).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      ) : (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            Off. Each year group takes students from its own occupancy ramp until this is switched on.
          </p>
        </CardContent>
      )}
    </Card>
  )
}

function SummaryStat({ label, value, term }: { label: string; value: string; term?: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{label}</span>
        {term ? <GlossaryHint term={term} currentValue={value} context={label} /> : null}
      </p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
