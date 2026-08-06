'use client'

import { useState } from 'react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ComparisonColumn } from './comparison-types'
import { ValueWithDelta } from './scenario-checkpoint-table'
import { YEAR_METRICS, type YearMetricKey, formatMetricValue, yearMetricValue } from './scenario-metrics'

interface YearRow {
  yearIndex: number
}

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
  const rows: YearRow[] = Array.from({ length: maxYears }, (_, yearIndex) => ({ yearIndex }))

  const gridColumns: GridColumnDef<YearRow>[] = [
    {
      id: 'year',
      label: 'Year',
      kind: 'readonly',
      width: 96,
      minWidth: 88,
      pinned: 'left',
      getValue: (row) => `Year ${row.yearIndex + 1}`,
    },
    ...columns.map(
      (column): GridColumnDef<YearRow> => ({
        id: column.id,
        label: column.id === baselineColumn?.id ? `${column.label} (baseline)` : column.label,
        kind: 'readonly',
        width: 144,
        minWidth: 128,
        getValue: (row) => yearMetricValue(column, metric.key, row.yearIndex),
        render: (row) => {
          const value = yearMetricValue(column, metric.key, row.yearIndex)
          if (value === null) return <span className="text-muted-foreground">—</span>
          const isBaseline = column.id === baselineColumn?.id
          const baselineValue = baselineColumn ? yearMetricValue(baselineColumn, metric.key, row.yearIndex) : null
          const delta = !isBaseline && baselineValue !== null ? value - baselineValue : null
          return (
            <ValueWithDelta
              delta={delta}
              invert={metric.invert}
              formatValue={() => formatMetricValue(metric.kind, value, column)}
              formatDelta={(delta) => formatMetricValue(metric.kind, delta, column)}
            />
          )
        },
      }),
    ),
  ]

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
      <CardContent className="pt-0">
        <DataGrid
          rows={rows}
          getRowId={(row) => String(row.yearIndex)}
          columns={gridColumns}
          mode="display"
          gridId="scenarios-year-by-year"
          ariaLabel="Compare by forecast year"
          rowHeight={44}
        />
      </CardContent>
    </Card>
  )
}
