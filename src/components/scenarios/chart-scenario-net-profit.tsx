'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyText } from '@/components/ui/currency-text'
import { renderChartLegend } from '@/components/revenue/chart-tooltip'
import { formatCompactMoneySigned, formatMoney } from '@/lib/format'
import type { ComparisonColumn } from './comparison-types'

const LINE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']

export function ChartScenarioNetProfit({ columns }: { columns: ComparisonColumn[] }) {
  const maxYears = Math.max(...columns.map((column) => column.costForecast.years.length), 0)
  const data = Array.from({ length: maxYears }, (_, yearIndex) => {
    const row: Record<string, number | string> = { label: `Year ${yearIndex + 1}` }
    for (const column of columns) {
      const year = column.costForecast.years[yearIndex]
      if (year) row[column.id] = year.netProfit
    }
    return row
  })

  const tickFormatter = (value: number) =>
    columns[0] ? formatCompactMoneySigned(value, columns[0].project.meta) : String(value)

  const renderTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
        <p className="mb-1.5 font-medium text-foreground">{label}</p>
        <dl className="flex flex-col gap-1">
          {payload.map((entry) => {
            const column = columns.find((candidate) => candidate.id === entry.dataKey)
            const value = Number(entry.value)
            return (
              <div key={String(entry.dataKey)} className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <dt className="text-muted-foreground">{entry.name}</dt>
                <dd className="ml-auto font-semibold tabular-nums">
                  {column ? <CurrencyText value={formatMoney(value, column.project.meta)} /> : value}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net profit by project</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={tickFormatter}
            />
            <Tooltip content={renderTooltip} />
            <Legend content={renderChartLegend} />
            {columns.map((column, index) => (
              <Line
                key={column.id}
                type="monotone"
                dataKey={column.id}
                name={column.label}
                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
