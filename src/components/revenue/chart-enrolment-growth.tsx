'use client'

import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatCompactNumber, formatNumber } from '@/lib/format'
import { ChartTooltip } from './chart-tooltip'

export function ChartEnrolmentGrowth({ project, forecast }: { project: Project; forecast: Forecast }) {
  const gradientId = useId()
  const data = forecast.years.map((year) => ({ label: year.label, students: year.students }))
  const tickFormatter = (value: number) => formatCompactNumber(value, project.meta.locale)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrolment growth</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.12} />
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
              width={40}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={tickFormatter}
            />
            <Tooltip
              content={(tooltipProps) => (
                <ChartTooltip
                  {...tooltipProps}
                  meta={project.meta}
                  valueFormatter={(value) => formatNumber(value, project.meta.locale)}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="students"
              name="Students"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
