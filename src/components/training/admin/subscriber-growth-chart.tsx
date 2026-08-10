'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { TrendGranularity } from '@/domain/training/analytics'
import type { SubscriberGrowthPoint } from '@/lib/training/subscriber-analytics'
import { AnalyticsChartTooltip } from './analytics/chart-tooltip'
import { AnalyticsEmptyState } from './analytics/empty-state'

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

/** Sets the analytics-only date range — deliberately separate from the table's "Date subscribed" filter, since this scopes the KPI row and growth trend's time window, not which rows appear in the list below. */
function AnalyticsDateRangeControl() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="Analytics period from"
        defaultValue={searchParams.get('analyticsFrom') ?? ''}
        onChange={(event) => updateParam('analyticsFrom', event.target.value || null)}
        className="w-36"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        aria-label="Analytics period to"
        defaultValue={searchParams.get('analyticsTo') ?? ''}
        onChange={(event) => updateParam('analyticsTo', event.target.value || null)}
        className="w-36"
      />
    </div>
  )
}

export function SubscriberGrowthChart({ trends }: { trends: Record<TrendGranularity, SubscriberGrowthPoint[]> }) {
  const [granularity, setGranularity] = useState<TrendGranularity>('DAY')
  const points = trends[granularity]
  const data = points.map((point) => ({
    label: formatBucketLabel(point.bucketStart, granularity),
    'New subscriptions': point.newSubscriptions,
    Unsubscribes: point.unsubscribes,
    'Net growth': point.netGrowth,
  }))

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Subscriber growth</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <AnalyticsDateRangeControl />
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
        </div>
      </CardHeader>
      <CardContent className="h-80 pt-0">
        {data.length === 0 ? (
          <AnalyticsEmptyState message="No subscriber activity for the current period." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
              <Tooltip content={(tooltipProps) => <AnalyticsChartTooltip {...tooltipProps} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="New subscriptions"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="Unsubscribes"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--chart-2)', stroke: 'var(--card)', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="Net growth"
                stroke="var(--chart-3)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: 'var(--chart-3)', stroke: 'var(--card)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
