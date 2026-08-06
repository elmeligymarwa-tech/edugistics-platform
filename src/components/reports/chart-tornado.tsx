'use client'

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProjectMeta } from '@/domain/schema'
import type { TornadoEntry } from '@/engine/analysis'
import { formatCompactMoneySigned, formatMoney } from '@/lib/format'

function TornadoTooltip({
  active,
  payload,
  meta,
}: TooltipContentProps & { meta: ProjectMeta }) {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0]?.payload as { label: string; low: number; high: number } | undefined
  if (!entry) return null

  return (
    <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{entry.label}</p>
      <dl className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Low</dt>
          <dd className="ml-auto font-semibold tabular-nums text-foreground">{formatMoney(entry.low, meta).text}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">High</dt>
          <dd className="ml-auto font-semibold tabular-nums text-foreground">{formatMoney(entry.high, meta).text}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * A tornado chart: one floating bar per driver spanning its low-to-high
 * equity value swing, sorted largest swing first, with the base case marked.
 * Shared by the Valuation and Scenarios pages.
 */
export function ChartTornado({
  meta,
  base,
  entries,
}: {
  meta: ProjectMeta
  base: number
  entries: TornadoEntry[]
}) {
  const data = entries.map((entry) => ({
    label: entry.label,
    range: [Math.min(entry.low, entry.high), Math.max(entry.low, entry.high)],
    low: entry.low,
    high: entry.high,
  }))
  const tickFormatter = (value: number) => formatCompactMoneySigned(value, meta)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equity value sensitivity (tornado)</CardTitle>
      </CardHeader>
      <CardContent className="pt-0" style={{ height: Math.max(220, entries.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={tickFormatter}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={140}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <ReferenceLine
              x={base}
              stroke="var(--chart-1)"
              strokeDasharray="4 4"
              label={{ value: 'Base case', position: 'insideTopRight', fill: 'var(--chart-1)', fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: 'var(--muted)' }} content={(props) => <TornadoTooltip {...props} meta={meta} />} />
            <Bar dataKey="range" name="Equity value range" fill="var(--chart-2)" radius={4} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
