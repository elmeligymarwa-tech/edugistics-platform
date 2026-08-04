'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatCompactMoney } from '@/lib/format'
import { ChartTooltip, renderChartLegend } from './chart-tooltip'

const CATEGORY_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const MAX_SERIES = CATEGORY_COLORS.length

export function ChartRevenueMix({ project, forecast }: { project: Project; forecast: Forecast }) {
  const categories = project.fees.categories
  const shown = categories.slice(0, MAX_SERIES)
  const overflow = categories.slice(MAX_SERIES)

  if (shown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue mix by category</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">No fee categories configured yet.</p>
        </CardContent>
      </Card>
    )
  }

  const data = forecast.years.map((year) => {
    const row: Record<string, string | number> = { label: year.label }
    for (const category of shown) row[category.id] = year.byCategory[category.id] ?? 0
    if (overflow.length > 0) {
      row.other = overflow.reduce((sum, category) => sum + (year.byCategory[category.id] ?? 0), 0)
    }
    return row
  })

  const series = [
    ...shown.map((category, index) => ({
      key: category.id,
      name: category.name,
      color: CATEGORY_COLORS[index]!,
    })),
    ...(overflow.length > 0 ? [{ key: 'other', name: 'Other', color: 'var(--muted-foreground)' }] : []),
  ]
  const tickFormatter = (value: number) => formatCompactMoney(value, project.meta)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue mix by category</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            <Tooltip
              cursor={{ fill: 'var(--muted)' }}
              content={(tooltipProps) => <ChartTooltip {...tooltipProps} meta={project.meta} />}
            />
            <Legend content={renderChartLegend} />
            {series.map((entry, index) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.name}
                stackId="mix"
                fill={entry.color}
                radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={32}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
