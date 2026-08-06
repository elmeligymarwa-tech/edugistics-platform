import type { CapitalModel } from '@/domain/capital'
import type { CostModel } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import { computeCapitalForecast } from '@/engine/capital'
import type { CostForecast } from '@/engine/costs'

export interface SensitivityGrid {
  rowLabel: string
  colLabel: string
  rowValues: number[]
  colValues: number[]
  /** equityValues[rowIndex][colIndex] */
  equityValues: number[][]
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const DISCOUNT_DELTAS = [-2, -1, 0, 1, 2]
const SECONDARY_DELTAS = [-2, -1, 0, 1, 2]

/**
 * Sweeps the discount rate against the terminal driver (terminal growth for a
 * perpetuity valuation, exit multiple for an exit multiple valuation),
 * re-running computeCapitalForecast for every combination. Never recomputes
 * the valuation itself — it only orchestrates the engine over a grid of
 * mutated capital model clones, the same technique the tornado function uses.
 */
export function buildValuationSensitivityGrid(
  project: Project,
  cost: CostModel,
  capital: CapitalModel,
  costForecast: CostForecast,
): SensitivityGrid {
  const isExitMultiple = capital.valuation.method === 'exitMultiple'

  const rowValues = DISCOUNT_DELTAS.map((delta) =>
    Math.max(0, capital.valuation.discountRatePct + delta),
  )
  const colValues = SECONDARY_DELTAS.map((delta) =>
    isExitMultiple
      ? Math.max(0, capital.valuation.exitEbitdaMultiple + delta)
      : capital.valuation.terminalGrowthPct + delta / 2,
  )

  const equityValues = rowValues.map((discountRatePct) =>
    colValues.map((secondary) => {
      const next = clone(capital)
      next.valuation.discountRatePct = discountRatePct
      if (isExitMultiple) next.valuation.exitEbitdaMultiple = secondary
      else next.valuation.terminalGrowthPct = secondary
      return computeCapitalForecast(project, cost, next, costForecast).valuation.equityValue
    }),
  )

  return {
    rowLabel: 'Discount rate',
    colLabel: isExitMultiple ? 'Exit multiple' : 'Terminal growth',
    rowValues,
    colValues,
    equityValues,
  }
}
