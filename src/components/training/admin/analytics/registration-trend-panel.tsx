'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TrendGranularity } from '@/domain/training/analytics'
import type { TrendPoint } from '@/lib/training/analytics'
import { AnalyticsChartTooltip } from './chart-tooltip'
import { AnalyticsEmptyState } from './empty-state'

const GRANULARITY_OPTIONS: { value: TrendGranularity; label: string }[] = [
  { value: 'DAY', label: 'Day' },
  { value: 'WEEK', label: 'Week' },
  { value: 'MONTH', label: 'Month' },
]

function formatBucketLabel(bucketStart: string, granularity: TrendGranularity): string {
  const date = new Date(bucketStart)
  if (granularity === 'MONTH') {
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

export function RegistrationTrendPanel({ trends }: { trends: Record<TrendGranularity, TrendPoint[]> }) {
  const [granularity, setGranularity] = useState<TrendGranularity>('DAY')
  const points = trends[granularity]
  const data = points.map((point) => ({ label: formatBucketLabel(point.bucketStart, granularity), count: point.count }))

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Registration trend</CardTitle>
        <div className="flex gap-1">
          {GRANULARITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="xs"
              variant={granularity === option.value ? 'secondary' : 'ghost'}
              onClick={() => setGranularity(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        {data.length === 0 ? (
          <AnalyticsEmptyState message="No confirmed registrations for the current filters." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <Tooltip content={(tooltipProps) => <AnalyticsChartTooltip {...tooltipProps} />} />
              <Line
                type="monotone"
                dataKey="count"
                name="Registrations"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
