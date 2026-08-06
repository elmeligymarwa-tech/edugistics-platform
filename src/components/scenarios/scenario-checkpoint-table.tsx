'use client'

import { DataGrid, type GridColumnDef, type GridColumnGroup } from '@/components/grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney, type FormattedCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ComparisonColumn } from './comparison-types'
import { YEAR_METRICS, type YearMetricKey, formatMetricValue, isImprovement, yearMetricValue } from './scenario-metrics'

const CHECKPOINTS = [
  { label: 'Year 1', yearIndex: 0 },
  { label: 'Year 5', yearIndex: 4 },
  { label: 'Year 10', yearIndex: 9 },
]

interface MetricRow {
  key: YearMetricKey
  label: string
}

interface SummaryRow {
  key: 'breakEven' | 'peakFunding'
  label: string
}

export type FormattableValue = string | FormattedCurrency

function valueText(value: FormattableValue): string {
  return typeof value === 'object' ? value.text : value
}

/**
 * The headline row colours from the formatter's own negative flag. The
 * delta row below it colours from `isImprovement` instead — a negative
 * delta can be good news (e.g. a liability going down) — so it deliberately
 * ignores `formatDelta`'s own negative flag and only reads its bracketed
 * text.
 */
export function ValueWithDelta({
  delta,
  formatValue,
  formatDelta,
  invert = true,
}: {
  delta: number | null
  formatValue: () => FormattableValue
  formatDelta: (delta: number) => FormattableValue
  invert?: boolean
}) {
  const value = formatValue()
  const negative = typeof value === 'object' && value.negative
  return (
    <div className="w-full text-right">
      <div className={cn('tabular-nums', negative ? 'text-destructive' : 'text-foreground')}>{valueText(value)}</div>
      {delta !== null && delta !== 0 ? (
        <div className={`text-xs tabular-nums ${isImprovement(delta, invert) ? 'text-success' : 'text-destructive'}`}>
          {delta > 0 ? '+' : ''}
          {valueText(formatDelta(delta))}
        </div>
      ) : null}
    </div>
  )
}

export function ScenarioCheckpointTable({
  columns,
  baselineId,
}: {
  columns: ComparisonColumn[]
  baselineId: string | null
}) {
  const baselineColumn = columns.find((column) => column.id === baselineId) ?? columns[0]

  const metricRows: MetricRow[] = YEAR_METRICS.map((metric) => ({ key: metric.key, label: metric.label }))

  const snapshotColumns: (GridColumnDef<MetricRow> | GridColumnGroup<MetricRow>)[] = [
    {
      id: 'label',
      label: 'Metric',
      kind: 'readonly',
      width: 180,
      minWidth: 150,
      pinned: 'left',
      getValue: (row) => row.label,
    },
    ...columns.map(
      (column): GridColumnGroup<MetricRow> => ({
        id: column.id,
        label: column.id === baselineColumn?.id ? `${column.label} (baseline)` : column.label,
        columns: CHECKPOINTS.map(
          (checkpoint): GridColumnDef<MetricRow> => ({
            id: `${column.id}-${checkpoint.label}`,
            label: checkpoint.label,
            kind: 'readonly',
            width: 112,
            minWidth: 96,
            getValue: (row) => yearMetricValue(column, row.key, checkpoint.yearIndex),
            render: (row) => {
              const metric = YEAR_METRICS.find((entry) => entry.key === row.key)!
              const value = yearMetricValue(column, row.key, checkpoint.yearIndex)
              if (value === null) return <span className="text-muted-foreground">—</span>
              const isBaseline = column.id === baselineColumn?.id
              const baselineValue = baselineColumn ? yearMetricValue(baselineColumn, row.key, checkpoint.yearIndex) : null
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
      }),
    ),
  ]

  const summaryRows: SummaryRow[] = [
    { key: 'breakEven', label: 'Break-even year' },
    { key: 'peakFunding', label: 'Peak funding requirement' },
  ]

  const summaryColumns: GridColumnDef<SummaryRow>[] = [
    {
      id: 'label',
      label: 'Metric',
      kind: 'readonly',
      width: 180,
      minWidth: 150,
      pinned: 'left',
      getValue: (row) => row.label,
    },
    ...columns.map(
      (column): GridColumnDef<SummaryRow> => ({
        id: column.id,
        label: column.id === baselineColumn?.id ? `${column.label} (baseline)` : column.label,
        kind: 'readonly',
        width: 160,
        minWidth: 140,
        getValue: () => null,
        render: (row) => {
          const isBaseline = column.id === baselineColumn?.id
          if (row.key === 'breakEven') {
            const index = column.costForecast.breakEvenYearIndex
            const label = index !== null ? (column.costForecast.years[index]?.label ?? 'Not within forecast') : 'Not within forecast'
            const baselineIndex = baselineColumn?.costForecast.breakEvenYearIndex ?? null
            const delta = !isBaseline && index !== null && baselineIndex !== null ? index - baselineIndex : null
            return (
              <ValueWithDelta
                delta={delta}
                formatValue={() => label}
                formatDelta={(delta) => `${delta} yr`}
              />
            )
          }
          const value = column.costForecast.peakFundingRequirement
          const baselineValue = baselineColumn?.costForecast.peakFundingRequirement ?? null
          const delta = !isBaseline && baselineValue !== null ? value - baselineValue : null
          return (
            <ValueWithDelta
              delta={delta}
              formatValue={() => formatMoney(value, column.project.meta)}
              formatDelta={(delta) => formatMoney(delta, column.project.meta)}
            />
          )
        },
      }),
    ),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Snapshot at year one, five and ten</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <DataGrid
          rows={metricRows}
          getRowId={(row) => row.key}
          columns={snapshotColumns}
          mode="display"
          gridId="scenarios-checkpoint-snapshot"
          ariaLabel="Snapshot at year one, five and ten"
          rowHeight={44}
        />
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Whole-forecast metrics</p>
          <DataGrid
            rows={summaryRows}
            getRowId={(row) => row.key}
            columns={summaryColumns}
            mode="display"
            gridId="scenarios-checkpoint-summary"
            ariaLabel="Whole-forecast metrics"
            rowHeight={44}
          />
        </div>
      </CardContent>
    </Card>
  )
}
