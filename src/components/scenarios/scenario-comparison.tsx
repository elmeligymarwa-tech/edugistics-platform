'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import { formatMoney } from '@/lib/format'
import { selectCostForecast, useProjectStore, type ScenarioMeta } from '@/store/project-store'

const MAX_COMPARISON = 3

type MetricKey = 'netRevenue' | 'ebitda' | 'netProfit' | 'breakEven' | 'peakFunding'

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: 'netRevenue', label: 'Net revenue' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'netProfit', label: 'Net profit' },
  { key: 'breakEven', label: 'Break-even year' },
  { key: 'peakFunding', label: 'Peak funding requirement' },
]

export function ScenarioComparison({
  project,
  scenarios,
}: {
  project: Project
  scenarios: Record<string, ScenarioMeta>
}) {
  const projects = useProjectStore((state) => state.projects)
  const costModels = useProjectStore((state) => state.costModels)

  const candidateIds = [
    project.id,
    ...Object.entries(scenarios)
      .filter(([, meta]) => meta.baseProjectId === project.id)
      .map(([id]) => id),
  ]

  const [selected, setSelected] = useState<string[]>(candidateIds.slice(0, 2))

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((entry) => entry !== id)
      if (prev.length >= MAX_COMPARISON) return prev
      return [...prev, id]
    })
  }

  const labelFor = (id: string) => (id === project.id ? project.meta.schoolName : (scenarios[id]?.name ?? id))

  const columns = selected
    .map((id) => {
      const columnProject = projects[id]
      const costModel = costModels[id]
      if (!columnProject || !costModel) return null
      const costForecast = selectCostForecast(columnProject, costModel)
      const finalYear = costForecast.years[costForecast.years.length - 1]
      return { id, label: labelFor(id), project: columnProject, costForecast, finalYear }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const metricValue = (
    column: (typeof columns)[number],
    metric: MetricKey,
  ): { display: string; numeric: number | null } => {
    switch (metric) {
      case 'netRevenue':
        return { display: formatMoney(column.finalYear?.netRevenue ?? 0, column.project.meta), numeric: column.finalYear?.netRevenue ?? 0 }
      case 'ebitda':
        return { display: formatMoney(column.finalYear?.ebitda ?? 0, column.project.meta), numeric: column.finalYear?.ebitda ?? 0 }
      case 'netProfit':
        return { display: formatMoney(column.finalYear?.netProfit ?? 0, column.project.meta), numeric: column.finalYear?.netProfit ?? 0 }
      case 'peakFunding':
        return {
          display: formatMoney(column.costForecast.peakFundingRequirement, column.project.meta),
          numeric: column.costForecast.peakFundingRequirement,
        }
      case 'breakEven': {
        const index = column.costForecast.breakEvenYearIndex
        const label = index !== null ? (column.costForecast.years[index]?.label ?? 'Not within forecast') : 'Not within forecast'
        return { display: label, numeric: index }
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare scenarios</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {candidateIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={!selected.includes(id) && selected.length >= MAX_COMPARISON}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Badge variant={selected.includes(id) ? 'brand' : 'outline'}>{labelFor(id)}</Badge>
            </button>
          ))}
        </div>

        {columns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select two or three scenarios above to compare.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">Metric</th>
                  {columns.map((column) => (
                    <th key={column.id} className="p-2 text-right font-medium text-muted-foreground">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => {
                  const baseline = metricValue(columns[0]!, metric.key)
                  return (
                    <tr key={metric.key} className="border-t border-border">
                      <td className="sticky left-0 bg-card p-2 font-medium text-foreground">{metric.label}</td>
                      {columns.map((column, index) => {
                        const value = metricValue(column, metric.key)
                        const delta =
                          index > 0 && value.numeric !== null && baseline.numeric !== null
                            ? value.numeric - baseline.numeric
                            : null
                        return (
                          <td key={column.id} className="p-2 text-right tabular-nums text-foreground">
                            <div>{value.display}</div>
                            {delta !== null && delta !== 0 ? (
                              <div className={`text-xs ${delta > 0 ? 'text-success' : 'text-destructive'}`}>
                                {delta > 0 ? '+' : ''}
                                {metric.key === 'breakEven'
                                  ? `${delta} yr`
                                  : formatMoney(delta, column.project.meta)}
                              </div>
                            ) : null}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
