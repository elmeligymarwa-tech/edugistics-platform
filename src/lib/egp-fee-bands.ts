import type { YearGroupId } from '@/domain/schema'

/**
 * Reference EGP annual tuition bands by market positioning, used by the AI
 * consultant's fee-positioning proposals. Edit these numbers in this one
 * place as the market moves — nothing else in the app hardcodes an EGP
 * figure. Each range runs foundation stage (low) to final secondary year
 * (high); `interpolateFeeLadder` spreads it across the selected year groups.
 */
export const EGP_ANNUAL_TUITION_BANDS = {
  budget: { low: 100_000, high: 140_000 },
  midMarket: { low: 135_000, high: 220_000 },
  premium: { low: 230_000, high: 300_000 },
  luxury: { low: 300_000, high: 500_000 },
} as const

export type FeePositioning = keyof typeof EGP_ANNUAL_TUITION_BANDS

export const FEE_POSITIONING_LABELS: Record<FeePositioning, string> = {
  budget: 'Budget',
  midMarket: 'Mid-market',
  premium: 'Premium',
  luxury: 'Luxury',
}

/** Rounds to the nearest 500 — a presentation-boundary rounding, never used inside the engine. */
function roundToNearest500(value: number): number {
  return Math.round(value / 500) * 500
}

/**
 * Interpolates a smooth fee ladder across the given year groups (ordered
 * foundation -> final secondary), linearly spanning the positioning's low
 * and high figures, rounded to the nearest 500.
 */
export function interpolateFeeLadder(
  positioning: FeePositioning,
  yearGroups: YearGroupId[],
): Record<YearGroupId, number> {
  const { low, high } = EGP_ANNUAL_TUITION_BANDS[positioning]
  const span = Math.max(1, yearGroups.length - 1)
  const ladder: Partial<Record<YearGroupId, number>> = {}

  yearGroups.forEach((group, index) => {
    const raw = yearGroups.length === 1 ? low : low + ((high - low) * index) / span
    ladder[group] = roundToNearest500(raw)
  })

  return ladder as Record<YearGroupId, number>
}
