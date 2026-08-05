'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatCompactMoney } from '@/lib/format'
import { ChartTooltip, renderChartLegend } from '@/components/revenue/chart-tooltip'

export function ChartRevenueVsCost({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const data = costForecast.years.map((year) => ({
    label: year.label,
    netRevenue: year.netRevenue,
    totalCost: year.payroll + year.opex + year.stm + year.depreciation,
  }))
  const tickFormatter = (value: number) => formatCompactMoney(value, project.meta)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net revenue vs total cost</CardTitle>
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
            <Bar dataKey="netRevenue" name="Net revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="totalCost" name="Total cost" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
