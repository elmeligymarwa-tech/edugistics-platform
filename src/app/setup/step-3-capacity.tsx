'use client'

import { useEffect, useState } from 'react'

import { DataGrid, toNumberOrZero, type GridColumnDef, type GridColumnGroup } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import { Switch } from '@/components/ui/switch'
import { orderedYearGroups, type Project, type SchoolPlan, type YearGroupId } from '@/domain/schema'
import { computeEnrolment, type YearGroupEnrolment } from '@/engine/revenue'
import { formatNumber } from '@/lib/format'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'

type SchoolRampMode = 'linear' | 'manual'

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
  const schoolRampActive = project.revenueAssumptions.schoolOccupancyPctByYear.length > 0
  const enrolment = computeEnrolment(project)
  const yearOne = enrolment[0] ?? []
  const finalYear = enrolment[enrolment.length - 1] ?? []
  const ceilingByGroup = new Map(yearOne.map((entry) => [entry.yearGroup, entry.capacityCeiling]))

  const totalMax = groups.reduce((sum, group) => sum + (ceilingByGroup.get(group) ?? 0), 0)
  const totalYearOne = yearOne.reduce((sum, entry) => sum + entry.students, 0)
  const totalFinalYear = finalYear.reduce((sum, entry) => sum + entry.students, 0)
  const totalTeachers = groups.reduce(
    (sum, group) =>
      sum + (project.capacity[group]?.teachers ?? 0) + (project.capacity[group]?.coTeachers ?? 0),
    0,
  )
  const ratio = totalTeachers > 0 ? totalMax / totalTeachers : 0

  return (
    <div className="flex flex-col gap-4">
      <SchoolPlanPanel project={project} enrolment={enrolment} />

      {!plan.enabled ? <SchoolOccupancyRamp project={project} /> : null}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-5">
          <SummaryStat label="Maximum students" value={Math.round(totalMax).toLocaleString()} />
          <SummaryStat label="Expected, year 1" value={Math.round(totalYearOne).toLocaleString()} />
          <SummaryStat
            label={`Expected, year ${forecastYears}`}
            value={Math.round(totalFinalYear).toLocaleString()}
          />
          <SummaryStat
            label="Student : teacher ratio"
            value={totalTeachers > 0 ? `${ratio.toFixed(1)} : 1` : '—'}
          />
          <SummaryStat
            label="Occupancy ramp"
            value={plan.enabled ? 'Top-down plan' : schoolRampActive ? 'School-wide' : 'Per year group'}
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
  allocatedByYear: number[]
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

  const rows: CapacityRow[] = groups.map((group) => ({
    group,
    allocatedByYear: enrolment.map((row) => row.find((entry) => entry.yearGroup === group)?.students ?? 0),
  }))

  const patch = (group: YearGroupId, values: Partial<Project['capacity'][string]>) =>
    updateCapacity(project.id, group, values)

  const numericColumn = (
    id: string,
    label: string,
    field: 'classrooms' | 'studentsPerClassroom' | 'teachers' | 'teachingAssistants' | 'coTeachers',
  ): GridColumnDef<CapacityRow> => ({
    id,
    label,
    kind: 'numeric',
    width: 128,
    minWidth: 104,
    allowFillDown: true,
    allowUplift: true,
    getValue: (row) => project.capacity[row.group]?.[field] ?? 0,
    onCommit: (row, value) => patch(row.group, { [field]: toNumberOrZero(value) }),
  })

  const columns: (GridColumnDef<CapacityRow> | GridColumnGroup<CapacityRow>)[] = [
    {
      id: 'group',
      label: 'Year group',
      kind: 'readonly',
      width: 140,
      minWidth: 120,
      pinned: 'left',
      getValue: (row) => YEAR_GROUP_LABELS[row.group],
    },
    numericColumn('classrooms', 'Classrooms', 'classrooms'),
    numericColumn('studentsPerClassroom', 'Students / classroom', 'studentsPerClassroom'),
    numericColumn('teachers', 'Teachers', 'teachers'),
    numericColumn('teachingAssistants', 'Teaching assistants', 'teachingAssistants'),
    numericColumn('coTeachers', 'Co-teachers', 'coTeachers'),
    {
      id: 'maxCapacityPct',
      label: 'Max capacity %',
      kind: 'percent',
      width: 128,
      minWidth: 104,
      allowFillDown: true,
      allowUplift: true,
      getValue: (row) => project.capacity[row.group]?.maxCapacityPct ?? 100,
      onCommit: (row, value) => patch(row.group, { maxCapacityPct: toNumberOrZero(value) }),
    },
    {
      id: 'maxStudents',
      label: 'Max students',
      kind: 'numeric',
      width: 128,
      minWidth: 104,
      allowFillDown: true,
      getValue: (row) => project.capacity[row.group]?.maxStudents ?? null,
      onCommit: (row, value) =>
        patch(row.group, { maxStudents: typeof value === 'number' ? Math.max(0, Math.round(value)) : null }),
    },
    {
      id: 'openFromYearIndex',
      label: 'Opens from year',
      kind: 'numeric',
      width: 128,
      minWidth: 112,
      getValue: (row) => (project.capacity[row.group]?.openFromYearIndex ?? 0) + 1,
      onCommit: (row, value) => patch(row.group, { openFromYearIndex: Math.max(0, toNumberOrZero(value) - 1) }),
    },
    {
      id: 'occupancy',
      label: 'Occupancy %',
      collapsible: true,
      defaultCollapsed: false,
      columns: Array.from({ length: forecastYears }, (_, yearIndex): GridColumnDef<CapacityRow> => ({
        id: `occupancy-${yearIndex}`,
        label: `Year ${yearIndex + 1}`,
        kind: 'percent',
        width: 96,
        minWidth: 88,
        allowFillDown: true,
        allowUplift: true,
        getValue: (row) => project.capacity[row.group]?.occupancyPctByYear[yearIndex] ?? 0,
        onCommit: (row, value) => {
          const current = project.capacity[row.group]?.occupancyPctByYear ?? []
          const next = [...current]
          while (next.length <= yearIndex) next.push(0)
          next[yearIndex] = toNumberOrZero(value)
          patch(row.group, { occupancyPctByYear: next })
        },
      })),
    },
    ...(planEnabled
      ? [
          {
            id: 'allocated',
            label: 'Allocated (from plan)',
            collapsible: true,
            defaultCollapsed: true,
            columns: Array.from({ length: forecastYears }, (_, yearIndex): GridColumnDef<CapacityRow> => ({
              id: `allocated-${yearIndex}`,
              label: `Year ${yearIndex + 1}`,
              kind: 'readonly',
              width: 96,
              minWidth: 88,
              getValue: (row) => row.allocatedByYear[yearIndex] ?? 0,
              format: (value) => (typeof value === 'number' ? formatNumber(value, project.meta.locale) : ''),
            })),
          } satisfies GridColumnGroup<CapacityRow>,
        ]
      : []),
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function SchoolOccupancyRamp({ project }: { project: Project }) {
  const updateRevenueAssumptions = useProjectStore((state) => state.updateRevenueAssumptions)
  const forecastYears = project.calendar.forecastYears
  const ramp = project.revenueAssumptions.schoolOccupancyPctByYear
  const enabled = ramp.length > 0

  const [mode, setMode] = useState<SchoolRampMode>('linear')
  const [linearStart, setLinearStart] = useState(60)
  const [linearTarget, setLinearTarget] = useState(100)
  const [rampYears, setRampYears] = useState(Math.min(3, forecastYears))

  useEffect(() => {
    if (ramp.length > 0 && ramp.length !== forecastYears) {
      const next = Array.from(
        { length: forecastYears },
        (_, index) => ramp[Math.min(index, ramp.length - 1)] ?? 0,
      )
      updateRevenueAssumptions(project.id, { schoolOccupancyPctByYear: next })
    }
    // Re-runs only when the project or the forecast horizon change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, forecastYears, ramp.length])

  const setEnabled = (checked: boolean) => {
    updateRevenueAssumptions(project.id, {
      schoolOccupancyPctByYear: checked ? Array.from({ length: forecastYears }, () => 0) : [],
    })
  }

  const applyLinear = () => {
    const years = Math.min(Math.max(1, rampYears), forecastYears)
    const span = Math.max(1, years - 1)
    const next = Array.from({ length: forecastYears }, (_, index) => {
      if (index >= years) return linearTarget
      return Math.round((linearStart + ((linearTarget - linearStart) * index) / span) * 10) / 10
    })
    updateRevenueAssumptions(project.id, { schoolOccupancyPctByYear: next })
  }

  const setManualValue = (index: number, value: number) => {
    const next = [...ramp]
    while (next.length <= index) next.push(next[next.length - 1] ?? 0)
    next[index] = value
    updateRevenueAssumptions(project.id, { schoolOccupancyPctByYear: next })
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>School-wide occupancy ramp</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Overrides every year group&apos;s own occupancy ramp while switched on.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          Apply one ramp to the whole school
        </label>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {enabled ? (
          <>
            <div className="flex gap-1">
              {(['linear', 'manual'] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="xs"
                  variant={mode === option ? 'default' : 'outline'}
                  onClick={() => setMode(option)}
                >
                  {option === 'linear' ? 'Linear ramp' : 'Manual entry'}
                </Button>
              ))}
            </div>

            {mode === 'linear' ? (
              <div className="flex flex-wrap items-end gap-4">
                <Field className="w-56">
                  <FieldLabel htmlFor="linearStart">Starting occupancy %</FieldLabel>
                  <SliderNumberField
                    id="linearStart"
                    aria-label="Starting occupancy %"
                    min={0}
                    max={100}
                    step={0.5}
                    suffix="%"
                    value={linearStart}
                    onValueChange={setLinearStart}
                  />
                </Field>
                <Field className="w-56">
                  <FieldLabel htmlFor="linearTarget">Target occupancy %</FieldLabel>
                  <SliderNumberField
                    id="linearTarget"
                    aria-label="Target occupancy %"
                    min={0}
                    max={100}
                    step={0.5}
                    suffix="%"
                    value={linearTarget}
                    onValueChange={setLinearTarget}
                  />
                </Field>
                <Field className="w-32">
                  <FieldLabel>Years to reach it</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={forecastYears}
                    value={rampYears}
                    onChange={(event) => setRampYears(Number(event.target.value))}
                  />
                </Field>
                <Button type="button" size="sm" onClick={applyLinear}>
                  Apply ramp
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {Array.from({ length: forecastYears }, (_, index) => (
                  <Field key={index} className="w-56">
                    <FieldLabel htmlFor={`manual-occupancy-${index}`}>Year {index + 1}</FieldLabel>
                    <SliderNumberField
                      id={`manual-occupancy-${index}`}
                      aria-label={`Year ${index + 1} occupancy %`}
                      min={0}
                      max={100}
                      step={0.5}
                      suffix="%"
                      value={ramp[index] ?? ramp[ramp.length - 1] ?? 0}
                      onValueChange={(value) => setManualValue(index, value)}
                    />
                  </Field>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Occupancy: {ramp.map((value) => `${Math.round(value)}%`).join(' → ')}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Off. Each year group uses its own saved occupancy ramp until this is switched on.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
