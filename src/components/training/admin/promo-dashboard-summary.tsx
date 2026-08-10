import { StatTile } from '@/components/ui/stat-tile'
import { formatCourseFee } from '@/domain/training/format'
import type { PromoCodeDashboardSummary } from '@/lib/training/promo-codes'

/**
 * Every figure here comes straight from getPromoCodeDashboardSummary — the
 * one authoritative implementation of these totals (src/lib/training/promo-codes.ts).
 * This component only formats and lays out what it's given; it never sums
 * or recalculates anything itself.
 */
export function PromoDashboardSummary({ summary, currency }: { summary: PromoCodeDashboardSummary; currency: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatTile label="Active promo codes" value={summary.activeCodes} />
        <StatTile label="Total promo uses" value={summary.totalUses} />
        <StatTile label="Total discount given" value={formatCourseFee(summary.totalDiscountGiven, currency)} />
        <StatTile label="Most used promo code" value={summary.mostUsedCode ? summary.mostUsedCode.code : '—'} hint={summary.mostUsedCode ? `${summary.mostUsedCode.uses} uses` : undefined} />
        <StatTile
          label="Highest value promo code"
          value={summary.highestValueCode ? summary.highestValueCode.code : '—'}
          hint={summary.highestValueCode ? formatCourseFee(summary.highestValueCode.potentialRegistrationValue, currency) : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Potential Registration Value and Total Discount Given are informational only — payment is collected outside
        this system, not through it.
      </p>
    </div>
  )
}
