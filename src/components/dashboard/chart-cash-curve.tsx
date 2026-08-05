'use client'

import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatCompactMoney } from '@/lib/format'
import { ChartTooltip } from '@/components/revenue/chart-tooltip'

export function ChartCashCurve({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const gradientId = useId()
  const data = costForecast.years.map((year) => ({ label: year.label, closingCash: year.closingCash }))
  const tickFormatter = (value: number) => formatCompactMoney(value, project.meta)
  const lowPointYear = costForecast.years.find((year) => year.closingCash === costForecast.cashLowPoint)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash curve</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.15} />
              </linearGradient>
            </defs>
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
            {lowPointYear ? (
              <ReferenceLine
                x={lowPointYear.label}
                stroke="var(--destructive)"
                strokeDasharray="4 4"
                label={{ value: 'Low point', position: 'insideTopRight', fill: 'var(--destructive)', fontSize: 11 }}
              />
            ) : null}
            <Tooltip
              content={(tooltipProps) => (
                <ChartTooltip
                  {...tooltipProps}
                  meta={project.meta}
                  valueFormatter={(value) => formatCompactMoney(value, project.meta)}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="closingCash"
              name="Closing cash"
              stroke="var(--chart-3)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 4, fill: 'var(--chart-3)', stroke: 'var(--card)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--chart-3)', stroke: 'var(--card)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
