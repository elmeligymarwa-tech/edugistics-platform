'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { AnalyticsChartTooltip } from './chart-tooltip'

export interface BarDatum {
  label: string
  value: number
}

/** A single-series categorical bar chart — the x-axis labels carry entity identity directly, so a legend would be redundant per a single series. Reused for every "count or value by X" panel on the dashboard so the same mark spec appears everywhere. */
export function AnalyticsBarChart({
  data,
  seriesName,
  valueFormatter,
}: {
  data: BarDatum[]
  seriesName: string
  valueFormatter?: (value: number) => string
}) {
  const tickFormatter = valueFormatter ?? ((value: number) => String(value))
  const rotateLabels = data.length > 6

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: rotateLabels ? 24 : 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={rotateLabels ? -25 : 0}
          textAnchor={rotateLabels ? 'end' : 'middle'}
          height={rotateLabels ? 48 : 24}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickFormatter={tickFormatter}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={(tooltipProps) => <AnalyticsChartTooltip {...tooltipProps} valueFormatter={valueFormatter} />}
        />
        <Bar dataKey="value" name={seriesName} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
