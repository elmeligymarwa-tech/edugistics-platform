import type { DefaultLegendContentProps, LegendPayload, TooltipContentProps } from 'recharts'

import type { ProjectMeta } from '@/domain/schema'
import { formatMoney, type FormattedCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

type TooltipValueFormatter = (value: number) => string | FormattedCurrency

export function ChartTooltip({
  active,
  payload,
  label,
  meta,
  valueFormatter,
}: TooltipContentProps & { meta: ProjectMeta; valueFormatter?: TooltipValueFormatter }) {
  if (!active || !payload || payload.length === 0) return null
  const format = valueFormatter ?? ((value: number) => formatMoney(value, meta))

  return (
    <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      <dl className="flex flex-col gap-1">
        {payload.map((entry) => {
          const formatted = format(Number(entry.value))
          const isFormattedCurrency = typeof formatted === 'object'
          return (
            <div key={String(entry.dataKey)} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <dt className="text-muted-foreground">{entry.name}</dt>
              <dd
                className={cn(
                  'ml-auto font-semibold tabular-nums',
                  isFormattedCurrency && formatted.negative ? 'text-destructive' : 'text-foreground',
                )}
              >
                {isFormattedCurrency ? formatted.text : formatted}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

export function renderChartLegend(props: DefaultLegendContentProps) {
  const payload = props.payload as ReadonlyArray<LegendPayload> | undefined
  if (!payload || payload.length === 0) return null

  return (
    <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {payload.map((entry, index) => (
        <li
          key={`${index}-${String(entry.dataKey ?? entry.value)}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}
