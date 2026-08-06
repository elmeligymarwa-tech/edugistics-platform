import type { Project, ProjectMeta } from '../domain/schema'
import type { CostModel } from '../domain/costs'
import type { CapitalModel } from '../domain/capital'
import { computeCostForecast } from './costs'
import { computeCapitalForecast } from './capital'

/**
 * Reporting and analysis. Currency conversion, model warnings and sensitivity.
 * Pure functions, no React, no I/O.
 */

/* -------------------------------------------------------------------- fx */

/**
 * Local currency per US dollar in a given forecast year. Uses the rate entered
 * for that year where one exists, otherwise the base rate held flat.
 */
export function exchangeRate(meta: ProjectMeta, yearIndex: number): number {
  const rates = meta.usdRateByYear
  if (rates.length === 0) return meta.usdRate
  return rates[Math.min(yearIndex, rates.length - 1)] ?? meta.usdRate
}

export function toUsd(value: number, meta: ProjectMeta, yearIndex: number): number {
  const rate = exchangeRate(meta, yearIndex)
  return rate > 0 ? value / rate : 0
}

/* -------------------------------------------------------------- warnings */

export type WarningSeverity = 'error' | 'warning'

export interface ModelWarning {
  code: 'feeCapBreach' | 'negativeCash'
  severity: WarningSeverity
  message: string
  yearIndex: number | null
  value: number
}

function ratesFor(rate: number | number[], years: number): number[] {
  if (Array.isArray(rate)) {
    return Array.from({ length: years }, (_, i) =>
      rate.length === 0 ? 0 : (rate[Math.min(i, rate.length - 1)] ?? 0),
    )
  }
  return Array.from({ length: years }, () => rate)
}

/**
 * Two checks only. Fee increases above the regulatory ceiling, and any year
 * where the closing cash balance falls below zero.
 */
export function validateModel(
  project: Project,
  cost: CostModel,
  capital?: CapitalModel,
): ModelWarning[] {
  const out: ModelWarning[] = []
  const years = project.calendar.forecastYears
  const cap = project.meta.feeEscalationCapPct

  const tuition = ratesFor(project.revenueAssumptions.tuitionEscalationPct, years)
  const other = ratesFor(project.revenueAssumptions.otherFeeEscalationPct, years)

  for (let y = 1; y < years; y += 1) {
    const worst = Math.max(tuition[y] ?? 0, other[y] ?? 0)
    if (worst > cap) {
      out.push({
        code: 'feeCapBreach',
        severity: 'error',
        message: `Fee increase of ${worst.toFixed(1)} per cent in year ${y + 1} exceeds the ${cap} per cent cap`,
        yearIndex: y,
        value: worst,
      })
    }
  }

  const costs = computeCostForecast(project, cost)
  const cash = capital
    ? computeCapitalForecast(project, cost, capital, costs).years.map((c) => c.closingCash)
    : costs.years.map((c) => c.closingCash)

  cash.forEach((balance, y) => {
    if (balance < 0) {
      out.push({
        code: 'negativeCash',
        severity: 'error',
        message: `Cash falls to ${Math.round(balance).toLocaleString()} in year ${y + 1}. Funding is needed before this point`,
        yearIndex: y,
        value: balance,
      })
    }
  })

  return out
}

/* ----------------------------------------------------------- sensitivity */

export interface TornadoEntry {
  driver: string
  label: string
  low: number
  high: number
  swing: number
}

type Mutator = (
  project: Project,
  cost: CostModel,
  capital: CapitalModel,
  factor: number,
) => { project: Project; cost: CostModel; capital: CapitalModel }

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const shift = (rate: number | number[], factor: number): number | number[] =>
  Array.isArray(rate) ? rate.map((r) => r * factor) : rate * factor

const DRIVERS: { key: string; label: string; apply: Mutator }[] = [
  {
    key: 'tuition',
    label: 'Tuition escalation',
    apply: (p, c, k, f) => {
      const project = clone(p)
      project.revenueAssumptions.tuitionEscalationPct = shift(
        project.revenueAssumptions.tuitionEscalationPct,
        f,
      )
      return { project, cost: c, capital: k }
    },
  },
  {
    key: 'occupancy',
    label: 'Enrolment',
    apply: (p, c, k, f) => {
      const project = clone(p)
      for (const key of Object.keys(project.capacity)) {
        const g = project.capacity[key]
        if (g) g.occupancyPctByYear = g.occupancyPctByYear.map((o) => Math.min(100, o * f))
      }
      project.revenueAssumptions.schoolOccupancyPctByYear =
        project.revenueAssumptions.schoolOccupancyPctByYear.map((o) => Math.min(100, o * f))
      project.revenueAssumptions.schoolPlan.totalStudentsByYear =
        project.revenueAssumptions.schoolPlan.totalStudentsByYear.map((t) => t * f)
      return { project, cost: c, capital: k }
    },
  },
  {
    key: 'salaries',
    label: 'Salary inflation',
    apply: (p, c, k, f) => {
      const cost = clone(c)
      cost.payroll.defaultIncrementPct = shift(cost.payroll.defaultIncrementPct, f)
      const project = clone(p)
      for (const pos of project.staffing.positions) pos.averageSalary *= f
      return { project, cost, capital: k }
    },
  },
  {
    key: 'opex',
    label: 'Operating costs',
    apply: (p, c, k, f) => {
      const cost = clone(c)
      for (const cat of cost.opex) cat.amount *= f
      return { project: p, cost, capital: k }
    },
  },
  {
    key: 'stm',
    label: 'STM revenue share',
    apply: (p, c, k, f) => {
      const project = clone(p)
      if (project.stm) project.stm.ratePct = Math.min(100, project.stm.ratePct * f)
      return { project, cost: c, capital: k }
    },
  },
  {
    key: 'discountRate',
    label: 'Discount rate',
    apply: (p, c, k, f) => {
      const capital = clone(k)
      capital.valuation.discountRatePct *= f
      return { project: p, cost: c, capital }
    },
  },
  {
    key: 'terminalGrowth',
    label: 'Terminal growth',
    apply: (p, c, k, f) => {
      const capital = clone(k)
      capital.valuation.terminalGrowthPct *= f
      return { project: p, cost: c, capital }
    },
  },
]

function equityValue(project: Project, cost: CostModel, capital: CapitalModel): number {
  return computeCapitalForecast(project, cost, capital).valuation.equityValue
}

/**
 * Move each driver up and down by the given percentage and record the effect
 * on equity value. Sorted by swing, largest first, which is the order a
 * tornado chart draws them.
 */
export function tornado(
  project: Project,
  cost: CostModel,
  capital: CapitalModel,
  deltaPct = 10,
): { base: number; entries: TornadoEntry[] } {
  const base = equityValue(project, cost, capital)
  const down = 1 - deltaPct / 100
  const up = 1 + deltaPct / 100

  const entries = DRIVERS.map(({ key, label, apply }) => {
    const lowCase = apply(project, cost, capital, down)
    const highCase = apply(project, cost, capital, up)
    const low = equityValue(lowCase.project, lowCase.cost, lowCase.capital)
    const high = equityValue(highCase.project, highCase.cost, highCase.capital)
    return { driver: key, label, low, high, swing: Math.abs(high - low) }
  })

  entries.sort((a, b) => b.swing - a.swing)
  return { base, entries }
}

/** Convert a whole forecast series into US dollars at the year by year rate. */
export function seriesToUsd(values: number[], meta: ProjectMeta): number[] {
  return values.map((v, y) => toUsd(v, meta, y))
}
