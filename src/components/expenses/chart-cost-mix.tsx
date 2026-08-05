'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OpexGroupSchema, type OpexCategory } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { OPEX_GROUP_LABELS } from '@/lib/expenses-data'
import { formatCompactMoney } from '@/lib/format'
import { ChartTooltip, renderChartLegend } from '@/components/revenue/chart-tooltip'

const GROUP_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function ChartCostMix({
  project,
  opex,
  costForecast,
}: {
  project: Project
  opex: OpexCategory[]
  costForecast: CostForecast
}) {
  const groupsPresent = OpexGroupSchema.options.filter((group) =>
    opex.some((category) => category.group === group),
  )

  if (groupsPresent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost mix by group</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">No expense categories configured yet.</p>
        </CardContent>
      </Card>
    )
  }

  const shown = groupsPresent.slice(0, GROUP_COLORS.length)
  const overflow = groupsPresent.slice(GROUP_COLORS.length)

  const data = costForecast.years.map((year) => {
    const row: Record<string, string | number> = { label: year.label }
    for (const group of shown) row[group] = year.opexByGroup[group] ?? 0
    if (overflow.length > 0) {
      row.other = overflow.reduce((sum, group) => sum + (year.opexByGroup[group] ?? 0), 0)
    }
    return row
  })

  const series = [
    ...shown.map((group, index) => ({ key: group, name: OPEX_GROUP_LABELS[group], color: GROUP_COLORS[index]! })),
    ...(overflow.length > 0 ? [{ key: 'other', name: 'Other', color: 'var(--muted-foreground)' }] : []),
  ]
  const tickFormatter = (value: number) => formatCompactMoney(value, project.meta)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost mix by group</CardTitle>
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
