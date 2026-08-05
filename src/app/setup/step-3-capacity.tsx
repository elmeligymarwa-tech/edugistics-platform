'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { orderedYearGroups, type Project, type YearGroupCapacity, type YearGroupId } from '@/domain/schema'
import { computeEnrolment } from '@/engine/revenue'
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
      <SchoolOccupancyRamp project={project} />

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
          <SummaryStat label="Occupancy ramp" value={schoolRampActive ? 'School-wide' : 'Per year group'} />
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select at least one year group in the previous step to configure capacity.
        </p>
      ) : (
        groups.map((group) => (
          <CapacityCard
            key={group}
            project={project}
            group={group}
            ceiling={ceilingByGroup.get(group) ?? 0}
          />
        ))
      )}
    </div>
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
              <div className="flex flex-wrap items-end gap-2">
                <Field className="w-32">
                  <FieldLabel>Starting occupancy %</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={linearStart}
                    onChange={(event) => setLinearStart(Number(event.target.value))}
                  />
                </Field>
                <Field className="w-32">
                  <FieldLabel>Target occupancy %</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={linearTarget}
                    onChange={(event) => setLinearTarget(Number(event.target.value))}
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
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: forecastYears }, (_, index) => (
                  <Field key={index} className="w-20">
                    <FieldLabel>Year {index + 1}</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={ramp[index] ?? ramp[ramp.length - 1] ?? 0}
                      onChange={(event) => setManualValue(index, Number(event.target.value))}
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

function CapacityCard({
  project,
  group,
  ceiling,
}: {
  project: Project
  group: YearGroupId
  ceiling: number
}) {
  const updateCapacity = useProjectStore((state) => state.updateCapacity)
  const capacity = project.capacity[group]

  if (!capacity) return null

  const patch = (values: Partial<YearGroupCapacity>) => updateCapacity(project.id, group, values)
  const classroomCapacity = capacity.classrooms * capacity.studentsPerClassroom

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{YEAR_GROUP_LABELS[group]}</CardTitle>
        <Badge variant="brand">{Math.round(ceiling).toLocaleString()} max students</Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field>
            <FieldLabel htmlFor={`${group}-classrooms`}>Classrooms</FieldLabel>
            <Input
              id={`${group}-classrooms`}
              type="number"
              min={0}
              value={capacity.classrooms}
              onChange={(event) => patch({ classrooms: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${group}-perClassroom`}>Students / classroom</FieldLabel>
            <Input
              id={`${group}-perClassroom`}
              type="number"
              min={0}
              value={capacity.studentsPerClassroom}
              onChange={(event) => patch({ studentsPerClassroom: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${group}-teachers`}>Teachers</FieldLabel>
            <Input
              id={`${group}-teachers`}
              type="number"
              min={0}
              value={capacity.teachers}
              onChange={(event) => patch({ teachers: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${group}-tas`}>Teaching assistants</FieldLabel>
            <Input
              id={`${group}-tas`}
              type="number"
              min={0}
              value={capacity.teachingAssistants}
              onChange={(event) => patch({ teachingAssistants: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${group}-coteachers`}>Co-teachers</FieldLabel>
            <Input
              id={`${group}-coteachers`}
              type="number"
              min={0}
              value={capacity.coTeachers}
              onChange={(event) => patch({ coTeachers: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${group}-maxstudents`}>Maximum students</FieldLabel>
            <Input
              id={`${group}-maxstudents`}
              type="number"
              min={0}
              step={1}
              placeholder={classroomCapacity.toLocaleString()}
              value={capacity.maxStudents ?? ''}
              onChange={(event) => {
                const raw = event.target.value
                patch({ maxStudents: raw === '' ? null : Math.max(0, Math.round(Number(raw))) })
              }}
            />
            <FieldDescription>
              {capacity.classrooms} × {capacity.studentsPerClassroom} = {classroomCapacity.toLocaleString()}{' '}
              classrooms × students
            </FieldDescription>
          </Field>
        </div>
      </CardContent>
    </Card>
  )
}
