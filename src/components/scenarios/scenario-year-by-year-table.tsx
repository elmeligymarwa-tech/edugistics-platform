'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ComparisonColumn } from './comparison-types'
import { YEAR_METRICS, type YearMetricKey, formatMetricValue, isImprovement, yearMetricValue } from './scenario-metrics'

export function ScenarioYearByYearTable({
  columns,
  baselineId,
}: {
  columns: ComparisonColumn[]
  baselineId: string | null
}) {
  const [metricKey, setMetricKey] = useState<YearMetricKey>('netProfit')
  const metric = YEAR_METRICS.find((entry) => entry.key === metricKey) ?? YEAR_METRICS[0]!
  const baselineColumn = columns.find((column) => column.id === baselineId) ?? columns[0]
  const maxYears = Math.max(...columns.map((column) => column.costForecast.years.length), 0)

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Compare by forecast year</CardTitle>
        <div className="flex flex-wrap gap-1">
          {YEAR_METRICS.map((entry) => (
            <Button
              key={entry.key}
              type="button"
              size="sm"
              variant={entry.key === metricKey ? 'default' : 'outline'}
              onClick={() => setMetricKey(entry.key)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">Year</th>
              {columns.map((column) => (
                <th key={column.id} className="p-2 text-right font-medium text-muted-foreground">
                  {column.label}
                  {column.id === baselineColumn?.id ? ' (baseline)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxYears }, (_, yearIndex) => (
              <tr key={yearIndex} className="border-t border-border">
                <td className="sticky left-0 bg-card p-2 text-foreground">Year {yearIndex + 1}</td>
                {columns.map((column) => {
                  const value = yearMetricValue(column, metric.key, yearIndex)
                  const isBaseline = column.id === baselineColumn?.id
                  if (value === null) {
                    return (
                      <td key={column.id} className="p-2 text-right text-muted-foreground">
                        —
                      </td>
                    )
                  }
                  const baselineValue = baselineColumn ? yearMetricValue(baselineColumn, metric.key, yearIndex) : null
                  const delta = !isBaseline && baselineValue !== null ? value - baselineValue : null
                  return (
                    <td key={column.id} className="p-2 text-right tabular-nums text-foreground">
                      <div>{formatMetricValue(metric.kind, value, column)}</div>
                      {delta !== null && delta !== 0 ? (
                        <div
                          className={`text-xs ${isImprovement(delta, metric.invert) ? 'text-success' : 'text-destructive'}`}
                        >
                          {delta > 0 ? '+' : ''}
                          {formatMetricValue(metric.kind, delta, column)}
                        </div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
