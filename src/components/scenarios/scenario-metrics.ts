import { formatMoney, formatNumber, type FormattedCurrency } from '@/lib/format'
import type { ComparisonColumn } from './comparison-types'

export type YearMetricKey = 'students' | 'netRevenue' | 'stmLiability' | 'ebitda' | 'netProfit'

/** `invert: true` means a lower value is the improvement (e.g. a liability). */
export const YEAR_METRICS: Array<{
  key: YearMetricKey
  label: string
  kind: 'money' | 'number'
  invert: boolean
}> = [
  { key: 'students', label: 'Students', kind: 'number', invert: false },
  { key: 'netRevenue', label: 'Net revenue', kind: 'money', invert: false },
  { key: 'stmLiability', label: 'STM share', kind: 'money', invert: true },
  { key: 'ebitda', label: 'EBITDA', kind: 'money', invert: false },
  { key: 'netProfit', label: 'Net profit', kind: 'money', invert: false },
]

export function yearMetricValue(column: ComparisonColumn, key: YearMetricKey, yearIndex: number): number | null {
  const year = column.costForecast.years[yearIndex]
  if (!year) return null
  switch (key) {
    case 'students':
      return year.students
    case 'netRevenue':
      return year.netRevenue
    case 'stmLiability':
      return year.stm
    case 'ebitda':
      return year.ebitda
    case 'netProfit':
      return year.netProfit
  }
}

export function formatMetricValue(
  kind: 'money' | 'number',
  value: number,
  column: ComparisonColumn,
): FormattedCurrency | string {
  return kind === 'money' ? formatMoney(value, column.project.meta) : formatNumber(value, column.project.meta.locale)
}

/** True when a delta of this sign is an improvement, given the metric's directionality. */
export function isImprovement(delta: number, invert: boolean): boolean {
  return invert ? delta < 0 : delta > 0
}
