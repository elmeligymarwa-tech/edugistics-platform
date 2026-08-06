import * as React from 'react'

import type { FormattedCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface NumericCellProps extends React.ComponentProps<'span'> {
  value: number | null
  /**
   * Pre-formatted display text. Pass the `{text, negative}` object returned
   * by formatMoney/formatCompactMoney so colour comes from the formatter's
   * own negative flag, not a re-test of the raw value — a plain string
   * (e.g. from formatPercent) falls back to colouring by `value < 0`.
   */
  formatted?: string | FormattedCurrency
  /** Larger figures (e.g. currency totals) want a wider floor than a bare percentage. */
  size?: 'sm' | 'md'
}

/**
 * The single implementation for "figures never clip": right-aligned,
 * tabular-nums, negatives in the theme's coral, and a minimum width floor so
 * a number is never squeezed narrower than it can read at. Used by grid
 * cells and standalone KPI tiles alike.
 */
function NumericCell({ value, formatted, size = 'sm', className, ...props }: NumericCellProps) {
  const isFormattedCurrency = typeof formatted === 'object' && formatted !== null
  const isNegative = isFormattedCurrency ? formatted.negative : typeof value === 'number' && value < 0
  const text = isFormattedCurrency ? formatted.text : (formatted ?? (value === null ? '' : String(value)))

  return (
    <span
      className={cn(
        'inline-block text-right tabular-nums',
        size === 'sm' ? 'min-w-24' : 'min-w-32',
        isNegative ? 'text-destructive' : 'text-foreground',
        className,
      )}
      {...props}
    >
      {text}
    </span>
  )
}

export { NumericCell }
