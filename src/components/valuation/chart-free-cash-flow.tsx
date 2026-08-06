'use client'

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartTooltip } from '@/components/revenue/chart-tooltip'
import type { Project } from '@/domain/schema'
import type { CapitalForecast } from '@/engine/capital'
import { formatCompactMoneySigned } from '@/lib/format'

export function ChartFreeCashFlow({
  project,
  capitalForecast,
}: {
  project: Project
  capitalForecast: CapitalForecast
}) {
  const data = capitalForecast.years.map((year, i) => ({
    label: year.label,
    freeCashFlow: capitalForecast.valuation.freeCashFlows[i] ?? 0,
  }))
  const tickFormatter = (value: number) => formatCompactMoneySigned(value, project.meta)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Free cash flow</CardTitle>
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
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip
              cursor={{ fill: 'var(--muted)' }}
              content={(tooltipProps) => (
                <ChartTooltip
                  {...tooltipProps}
                  meta={project.meta}
                  valueFormatter={(value) => formatCompactMoneySigned(value, project.meta)}
                />
              )}
            />
            <Bar dataKey="freeCashFlow" name="Free cash flow" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
