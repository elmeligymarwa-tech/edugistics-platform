'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { orderedYearGroups, type Project, type YearGroupCapacity, type YearGroupId } from '@/domain/schema'
import { computeEnrolment } from '@/engine/revenue'
import { cn } from '@/lib/utils'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'

type RampMode = 'linear' | 'manual' | 'copy'

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
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
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
            allGroups={groups}
            maxStudents={ceilingByGroup.get(group) ?? 0}
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

function CapacityCard({
  project,
  group,
  allGroups,
  maxStudents,
}: {
  project: Project
  group: YearGroupId
  allGroups: YearGroupId[]
  maxStudents: number
}) {
  const updateCapacity = useProjectStore((state) => state.updateCapacity)
  const capacity = project.capacity[group]
  const forecastYears = project.calendar.forecastYears
  const [mode, setMode] = useState<RampMode>('manual')
  const [linearStart, setLinearStart] = useState(60)
  const [linearEnd, setLinearEnd] = useState(100)
  const [copySource, setCopySource] = useState<YearGroupId | ''>('')

  if (!capacity) return null

  const occupancy = capacity.occupancyPctByYear
  const patch = (values: Partial<YearGroupCapacity>) => updateCapacity(project.id, group, values)

  const applyLinear = () => {
    const span = Math.max(1, forecastYears - 1)
    const next = Array.from({ length: forecastYears }, (_, index) =>
      Math.round((linearStart + ((linearEnd - linearStart) * index) / span) * 10) / 10,
    )
    patch({ occupancyPctByYear: next })
  }

  const applyCopy = () => {
    if (!copySource) return
    const source = project.capacity[copySource]?.occupancyPctByYear ?? []
    const next = Array.from(
      { length: forecastYears },
      (_, index) => source[Math.min(index, source.length - 1)] ?? 0,
    )
    patch({ occupancyPctByYear: next })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{YEAR_GROUP_LABELS[group]}</CardTitle>
        <Badge variant="brand">{Math.round(maxStudents).toLocaleString()} max students</Badge>
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
            <FieldLabel htmlFor={`${group}-maxpct`}>Maximum capacity %</FieldLabel>
            <Input
              id={`${group}-maxpct`}
              type="number"
              min={0}
              max={100}
              value={capacity.maxCapacityPct}
              onChange={(event) => patch({ maxCapacityPct: Number(event.target.value) })}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Occupancy ramp</p>
            <div className="flex gap-1">
              {(['linear', 'manual', 'copy'] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="xs"
                  variant={mode === option ? 'default' : 'outline'}
                  onClick={() => setMode(option)}
                >
                  {option === 'linear' ? 'Linear ramp' : option === 'manual' ? 'Manual entry' : 'Copy from…'}
                </Button>
              ))}
            </div>
          </div>

          {mode === 'manual' ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: forecastYears }, (_, index) => {
                const displayValue = occupancy[index] ?? occupancy[occupancy.length - 1] ?? 0
                return (
                  <Field key={index} className="w-20">
                    <FieldLabel>Year {index + 1}</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={displayValue}
                      onChange={(event) => {
                        const next = [...occupancy]
                        while (next.length <= index) next.push(next[next.length - 1] ?? 0)
                        next[index] = Number(event.target.value)
                        patch({ occupancyPctByYear: next })
                      }}
                    />
                  </Field>
                )
              })}
            </div>
          ) : null}

          {mode === 'linear' ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field className="w-24">
                <FieldLabel>Start %</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={linearStart}
                  onChange={(event) => setLinearStart(Number(event.target.value))}
                />
              </Field>
              <Field className="w-24">
                <FieldLabel>End %</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={linearEnd}
                  onChange={(event) => setLinearEnd(Number(event.target.value))}
                />
              </Field>
              <Button type="button" size="sm" onClick={applyLinear}>
                Apply ramp
              </Button>
            </div>
          ) : null}

          {mode === 'copy' ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field className="w-48">
                <FieldLabel>Copy from</FieldLabel>
                <Select
                  placeholder="Choose a year group"
                  value={copySource || undefined}
                  items={allGroups
                    .filter((entry) => entry !== group)
                    .map((entry) => ({ value: entry, label: YEAR_GROUP_LABELS[entry] }))}
                  onValueChange={(value) => setCopySource(value as YearGroupId)}
                />
              </Field>
              <Button type="button" size="sm" onClick={applyCopy} disabled={!copySource}>
                Copy occupancy
              </Button>
            </div>
          ) : null}

          <p className={cn('text-xs text-muted-foreground')}>
            Occupancy: {occupancy.map((value) => `${Math.round(value)}%`).join(' → ')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
