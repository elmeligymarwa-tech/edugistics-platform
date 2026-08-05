'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import type { ComparisonColumn } from './comparison-types'
import { YEAR_METRICS, formatMetricValue, isImprovement, yearMetricValue } from './scenario-metrics'

const CHECKPOINTS = [
  { label: 'Year 1', yearIndex: 0 },
  { label: 'Year 5', yearIndex: 4 },
  { label: 'Year 10', yearIndex: 9 },
]

export function ScenarioCheckpointTable({
  columns,
  baselineId,
}: {
  columns: ComparisonColumn[]
  baselineId: string | null
}) {
  const baselineColumn = columns.find((column) => column.id === baselineId) ?? columns[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Snapshot at year one, five and ten</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[32rem] overflow-auto pt-0">
        <table className="data-table w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 bg-card p-2 text-left align-bottom font-medium text-muted-foreground"
              >
                Metric
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  colSpan={CHECKPOINTS.length}
                  className="border-l border-border p-2 text-center font-medium text-muted-foreground"
                >
                  {column.label}
                  {column.id === baselineColumn?.id ? ' (baseline)' : ''}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((column) =>
                CHECKPOINTS.map((checkpoint) => (
                  <th
                    key={`${column.id}-${checkpoint.label}`}
                    className="border-l border-border p-2 text-right text-xs font-medium text-muted-foreground first:border-l-0"
                  >
                    {checkpoint.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {YEAR_METRICS.map((metric) => (
              <tr key={metric.key} className="border-t border-border">
                <td className="sticky left-0 bg-card p-2 font-medium text-foreground">{metric.label}</td>
                {columns.map((column) =>
                  CHECKPOINTS.map((checkpoint) => {
                    const value = yearMetricValue(column, metric.key, checkpoint.yearIndex)
                    const isBaseline = column.id === baselineColumn?.id
                    const baselineValue = baselineColumn
                      ? yearMetricValue(baselineColumn, metric.key, checkpoint.yearIndex)
                      : null
                    if (value === null) {
                      return (
                        <td
                          key={`${column.id}-${checkpoint.label}`}
                          className="border-l border-border p-2 text-right text-muted-foreground"
                        >
                          —
                        </td>
                      )
                    }
                    const delta = !isBaseline && baselineValue !== null ? value - baselineValue : null
                    return (
                      <td
                        key={`${column.id}-${checkpoint.label}`}
                        className="border-l border-border p-2 text-right tabular-nums text-foreground"
                      >
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
                  }),
                )}
              </tr>
            ))}
            <tr className="border-t border-border">
              <td
                colSpan={columns.length * CHECKPOINTS.length + 1}
                className="pt-4 pb-1 text-xs font-medium text-muted-foreground"
              >
                Whole-forecast metrics
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="sticky left-0 bg-card p-2 font-medium text-foreground">Break-even year</td>
              {columns.map((column) => {
                const index = column.costForecast.breakEvenYearIndex
                const label =
                  index !== null
                    ? (column.costForecast.years[index]?.label ?? 'Not within forecast')
                    : 'Not within forecast'
                const isBaseline = column.id === baselineColumn?.id
                const baselineIndex = baselineColumn?.costForecast.breakEvenYearIndex ?? null
                const delta = !isBaseline && index !== null && baselineIndex !== null ? index - baselineIndex : null
                return (
                  <td
                    key={column.id}
                    colSpan={CHECKPOINTS.length}
                    className="border-l border-border p-2 text-right tabular-nums text-foreground"
                  >
                    <div>{label}</div>
                    {delta !== null && delta !== 0 ? (
                      <div className={`text-xs ${isImprovement(delta, true) ? 'text-success' : 'text-destructive'}`}>
                        {delta > 0 ? '+' : ''}
                        {delta} yr
                      </div>
                    ) : null}
                  </td>
                )
              })}
            </tr>
            <tr className="border-t border-border">
              <td className="sticky left-0 bg-card p-2 font-medium text-foreground">Peak funding requirement</td>
              {columns.map((column) => {
                const value = column.costForecast.peakFundingRequirement
                const isBaseline = column.id === baselineColumn?.id
                const baselineValue = baselineColumn?.costForecast.peakFundingRequirement ?? null
                const delta = !isBaseline && baselineValue !== null ? value - baselineValue : null
                return (
                  <td
                    key={column.id}
                    colSpan={CHECKPOINTS.length}
                    className="border-l border-border p-2 text-right tabular-nums text-foreground"
                  >
                    <div>{formatMoney(value, column.project.meta)}</div>
                    {delta !== null && delta !== 0 ? (
                      <div className={`text-xs ${isImprovement(delta, true) ? 'text-success' : 'text-destructive'}`}>
                        {delta > 0 ? '+' : ''}
                        {formatMoney(delta, column.project.meta)}
                      </div>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
