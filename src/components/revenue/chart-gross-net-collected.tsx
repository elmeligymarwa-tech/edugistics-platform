'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatCompactMoneySigned } from '@/lib/format'
import { ChartTooltip, renderChartLegend } from './chart-tooltip'

export function ChartGrossNetCollected({ project, forecast }: { project: Project; forecast: Forecast }) {
  const data = forecast.years.map((year) => ({
    label: year.label,
    gross: year.grossRevenue,
    net: year.netRevenue,
    collected: year.collectedCash,
  }))
  const tickFormatter = (value: number) => formatCompactMoneySigned(value, project.meta)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gross vs net vs collected</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
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
            <Bar dataKey="gross" name="Gross revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="net" name="Net revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar
              dataKey="collected"
              name="Collected cash"
              fill="var(--chart-3)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
