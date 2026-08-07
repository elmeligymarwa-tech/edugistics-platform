import type { Forecast, YearForecast, YearGroupEnrolment } from '@/engine/revenue'
import { formatPercent } from '@/lib/format'

/**
 * Presentational ratios and helpers for the executive dashboard. Every figure
 * here is derived from computeForecast/computeCostForecast/computeCapitalForecast
 * output — nothing recalculates a figure the engines already own, this only
 * combines or compares figures that already exist.
 */

export interface TrendPoint {
  label: string
  value: number
}

/** Percentage change from `previous` to `current`. Null when `previous` is zero, since the change is undefined there rather than +/-Infinity. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatDeltaPct(deltaPct: number | null): string {
  if (deltaPct === null) return '—'
  const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '-' : ''
  return `${sign}${formatPercent(Math.abs(deltaPct))}`
}

/** Total students over total capacity ceiling for a forecast year. */
export function capacityUtilisationPct(enrolment: YearGroupEnrolment[]): number {
  const students = enrolment.reduce((sum, e) => sum + e.students, 0)
  const ceiling = enrolment.reduce((sum, e) => sum + e.capacityCeiling, 0)
  return ceiling > 0 ? (students / ceiling) * 100 : 0
}

export function newEntrantsForYear(enrolment: YearGroupEnrolment[]): number {
  return enrolment.reduce((sum, e) => sum + e.newEntrants, 0)
}

/** Sum of every year group's own capacity ceiling — not a separate, overall school ceiling. */
export function totalYearGroupCapacity(enrolment: YearGroupEnrolment[]): number {
  return enrolment.reduce((sum, e) => sum + e.capacityCeiling, 0)
}

/**
 * Headroom against the school-wide `Max School Students` planning ceiling. Null when no
 * ceiling is set (unlimited), so callers can render "No limit set" instead of a number.
 */
export function remainingSchoolCapacity(maxSchoolStudents: number | null, currentIntake: number): number | null {
  if (maxSchoolStudents === null) return null
  return maxSchoolStudents - currentIntake
}

/** Share of net revenue paid out under the STM agreement for a forecast year. */
export function stmRevenueSharePct(year: YearForecast): number {
  return year.netRevenue > 0 ? (year.stmLiability / year.netRevenue) * 100 : 0
}

/** Year-on-year student growth, indexed like `forecast.years` — index 0 is always null (no prior year). */
export function studentGrowthSeries(forecast: Forecast): Array<number | null> {
  return forecast.years.map((year, index) => {
    const prior = forecast.years[index - 1]
    return prior ? pctChange(year.students, prior.students) : null
  })
}

export function cumulativeSeries(values: number[]): number[] {
  let running = 0
  return values.map((value) => (running += value))
}
