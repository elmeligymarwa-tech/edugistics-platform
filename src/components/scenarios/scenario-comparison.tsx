'use client'

import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import { selectCostForecast, useProjectStore, type ScenarioMeta } from '@/store/project-store'
import { ChartScenarioNetProfit } from './chart-scenario-net-profit'
import type { ComparisonColumn } from './comparison-types'
import { ScenarioCheckpointTable } from './scenario-checkpoint-table'
import { ScenarioYearByYearTable } from './scenario-year-by-year-table'

const MIN_COMPARISON = 2
const MAX_COMPARISON = 3

function labelFor(id: string, projects: Record<string, Project>, scenarios: Record<string, ScenarioMeta>): string {
  return scenarios[id]?.name ?? projects[id]?.meta.schoolName ?? id
}

function subtitleFor(
  id: string,
  projects: Record<string, Project>,
  scenarios: Record<string, ScenarioMeta>,
): string | null {
  const meta = scenarios[id]
  if (!meta) return null
  const baseName = projects[meta.baseProjectId]?.meta.schoolName ?? 'a deleted project'
  return `Scenario of ${baseName}`
}

export function ScenarioComparison({ project }: { project: Project }) {
  const projects = useProjectStore((state) => state.projects)
  const scenarios = useProjectStore((state) => state.scenarios)
  const costModels = useProjectStore((state) => state.costModels)

  const allIds = useMemo(
    () =>
      Object.keys(projects).sort((a, b) =>
        labelFor(a, projects, scenarios).localeCompare(labelFor(b, projects, scenarios)),
      ),
    [projects, scenarios],
  )

  const [selected, setSelected] = useState<string[]>(() => (allIds.includes(project.id) ? [project.id] : []))
  const [baselineId, setBaselineId] = useState<string | null>(project.id)

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((entry) => entry !== id)
      if (prev.length >= MAX_COMPARISON) return prev
      return [...prev, id]
    })
  }

  const effectiveBaselineId = baselineId && selected.includes(baselineId) ? baselineId : (selected[0] ?? null)

  const columns: ComparisonColumn[] = selected
    .map((id) => {
      const columnProject = projects[id]
      const costModel = costModels[id]
      if (!columnProject || !costModel) return null
      return {
        id,
        label: labelFor(id, projects, scenarios),
        project: columnProject,
        costForecast: selectCostForecast(columnProject, costModel),
      }
    })
    .filter((entry): entry is ComparisonColumn => entry !== null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare projects</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Select two or three saved projects to compare, then mark one as the baseline.
          </p>
          <div className="flex flex-col gap-1.5">
            {allIds.map((id) => {
              const isSelected = selected.includes(id)
              const isBaseline = isSelected && effectiveBaselineId === id
              const subtitle = subtitleFor(id, projects, scenarios)
              return (
                <div
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    disabled={!isSelected && selected.length >= MAX_COMPARISON}
                    className="flex flex-1 cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Badge variant={isSelected ? 'brand' : 'outline'}>{labelFor(id, projects, scenarios)}</Badge>
                    {id === project.id ? <span className="text-xs text-muted-foreground">Active</span> : null}
                    {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
                  </button>
                  {isSelected ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={isBaseline ? 'default' : 'outline'}
                      onClick={() => setBaselineId(id)}
                    >
                      <Star data-icon="inline-start" />
                      {isBaseline ? 'Baseline' : 'Set as baseline'}
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {columns.length < MIN_COMPARISON ? (
          <p className="text-sm text-muted-foreground">Select at least two projects above to compare.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <ScenarioCheckpointTable columns={columns} baselineId={effectiveBaselineId} />
            <ScenarioYearByYearTable columns={columns} baselineId={effectiveBaselineId} />
            <ChartScenarioNetProfit columns={columns} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
