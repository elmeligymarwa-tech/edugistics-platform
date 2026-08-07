'use client'

import type { ReactNode } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'

import { GlossaryHint } from '@/components/glossary/glossary-hint'
import { Card } from '@/components/ui/card'
import { formatDeltaPct, type TrendPoint } from '@/lib/kpi'
import { cn } from '@/lib/utils'

function Sparkline({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) return <div className="h-9" aria-hidden />
  return (
    <div className="h-9 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface KpiCardProps {
  label: string
  /** Glossary entry id — omit where no matching entry exists rather than inventing one. */
  term?: string
  value: ReactNode
  glossaryValue?: string
  comparisonValue: ReactNode | null
  comparisonLabel: string
  /** Percentage change from the comparison value to the current value; null when no comparison is available. */
  deltaPct: number | null
  /** True when a decrease is the improvement (costs, liabilities, "earlier is better" year indices). */
  invert?: boolean
  trend: TrendPoint[]
  onOpenDrilldown: () => void
  className?: string
}

export function KpiCard({
  label,
  term,
  value,
  glossaryValue,
  comparisonValue,
  comparisonLabel,
  deltaPct,
  invert = false,
  trend,
  onOpenDrilldown,
  className,
}: KpiCardProps) {
  const isFlat = deltaPct === null || deltaPct === 0
  const isGood = isFlat ? null : invert ? deltaPct < 0 : deltaPct > 0
  const DeltaIcon = isFlat ? Minus : isGood ? TrendingUp : TrendingDown
  const deltaColor = isFlat ? 'text-muted-foreground' : isGood ? 'text-success' : 'text-destructive'

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpenDrilldown}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenDrilldown()
        }
      }}
      className={cn(
        '@container flex cursor-pointer flex-col gap-1.5 overflow-hidden p-4 text-left transition-colors',
        'hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <p className="flex items-center gap-1 truncate text-xs font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {term ? <GlossaryHint term={term} currentValue={glossaryValue} context={label} className="shrink-0" /> : null}
      </p>
      <p className="truncate text-lg font-semibold tabular-nums text-foreground @[11rem]:text-xl @[16rem]:text-2xl">
        {value}
      </p>
      <div className="flex items-center gap-1.5 text-xs">
        <span className={cn('flex shrink-0 items-center gap-0.5 font-medium tabular-nums', deltaColor)}>
          <DeltaIcon className="size-3.5" />
          {formatDeltaPct(deltaPct)}
        </span>
        <span className="truncate text-muted-foreground">{comparisonLabel}</span>
      </div>
      {comparisonValue !== null ? (
        <p className="truncate text-xs text-muted-foreground">{comparisonValue}</p>
      ) : null}
      <Sparkline data={trend} />
    </Card>
  )
}
