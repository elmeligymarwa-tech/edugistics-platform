import type { FormattedCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Renders a formatMoney/formatCompactMoney result inline, colouring from its
 * own `negative` flag rather than a caller re-testing the source value —
 * keeps the bracket-and-colour convention entirely inside the formatter.
 */
function CurrencyText({ value, className }: { value: FormattedCurrency; className?: string }) {
  return <span className={cn(value.negative ? 'text-destructive' : 'text-foreground', className)}>{value.text}</span>
}

export { CurrencyText }
