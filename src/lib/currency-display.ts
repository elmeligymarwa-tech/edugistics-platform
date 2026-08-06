import type { ProjectMeta } from '@/domain/schema'
import type { Forecast, YearForecast } from '@/engine/revenue'
import type { CostForecast, PayrollLine, YearPayroll, YearStatement } from '@/engine/costs'
import type { CapitalForecast, LoanYear, YearCapital } from '@/engine/capital'
import { toUsd } from '@/engine/analysis'

/**
 * Converts every money figure in a forecast to USD for display, using the
 * per-year exchange rate — never a single blanket rate — so a forecast
 * spanning years with different rates converts each year correctly. Counts,
 * percentages, indices and labels pass through untouched. Aggregates that
 * span years (totals, low points, peaks) are recomputed from the already
 * converted per-year series rather than converting the raw aggregate, since
 * a sum or minimum computed before conversion would mix years at the wrong
 * rate. Only ever reformats figures the engine already computed — never
 * recalculates them.
 */

function mapMoneyRecord(record: Record<string, number>, meta: ProjectMeta, yearIndex: number): Record<string, number> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toUsd(value, meta, yearIndex)]))
}

/** Local-currency ProjectMeta swapped to read as USD for presentation — never persisted, never fed back into a store action. */
export function toDisplayMeta(meta: ProjectMeta, showUsd: boolean): ProjectMeta {
  if (!showUsd) return meta
  return { ...meta, currencyCode: 'USD', currencySymbol: '$' }
}

function convertYearForecast(year: YearForecast, meta: ProjectMeta): YearForecast {
  const y = year.yearIndex
  return {
    ...year,
    grossRevenue: toUsd(year.grossRevenue, meta, y),
    discounts: toUsd(year.discounts, meta, y),
    netRevenue: toUsd(year.netRevenue, meta, y),
    taxCollected: toUsd(year.taxCollected, meta, y),
    collectedCash: toUsd(year.collectedCash, meta, y),
    stmLiability: toUsd(year.stmLiability, meta, y),
    revenuePerStudent: toUsd(year.revenuePerStudent, meta, y),
    byCategory: mapMoneyRecord(year.byCategory, meta, y),
    byYearGroup: mapMoneyRecord(year.byYearGroup, meta, y),
  }
}

export function revenueForecastToDisplay(forecast: Forecast, meta: ProjectMeta, showUsd: boolean): Forecast {
  if (!showUsd) return forecast
  const years = forecast.years.map((year) => convertYearForecast(year, meta))
  return {
    years,
    totals: {
      grossRevenue: years.reduce((sum, y) => sum + y.grossRevenue, 0),
      netRevenue: years.reduce((sum, y) => sum + y.netRevenue, 0),
      collectedCash: years.reduce((sum, y) => sum + y.collectedCash, 0),
      stmLiability: years.reduce((sum, y) => sum + y.stmLiability, 0),
    },
    cagrPct: forecast.cagrPct,
  }
}

function convertPayrollLine(line: PayrollLine, meta: ProjectMeta, yearIndex: number): PayrollLine {
  return {
    ...line,
    salaries: toUsd(line.salaries, meta, yearIndex),
    allowances: toUsd(line.allowances, meta, yearIndex),
    onCosts: toUsd(line.onCosts, meta, yearIndex),
    recruitment: toUsd(line.recruitment, meta, yearIndex),
    training: toUsd(line.training, meta, yearIndex),
    total: toUsd(line.total, meta, yearIndex),
  }
}

function convertYearPayroll(payroll: YearPayroll, meta: ProjectMeta): YearPayroll {
  const y = payroll.yearIndex
  return {
    ...payroll,
    salaries: toUsd(payroll.salaries, meta, y),
    allowances: toUsd(payroll.allowances, meta, y),
    onCosts: toUsd(payroll.onCosts, meta, y),
    recruitment: toUsd(payroll.recruitment, meta, y),
    training: toUsd(payroll.training, meta, y),
    total: toUsd(payroll.total, meta, y),
    lines: payroll.lines.map((line) => convertPayrollLine(line, meta, y)),
  }
}

function convertYearStatement(year: YearStatement, meta: ProjectMeta): YearStatement {
  const y = year.yearIndex
  return {
    ...year,
    netRevenue: toUsd(year.netRevenue, meta, y),
    payroll: toUsd(year.payroll, meta, y),
    opex: toUsd(year.opex, meta, y),
    stm: toUsd(year.stm, meta, y),
    ebitda: toUsd(year.ebitda, meta, y),
    depreciation: toUsd(year.depreciation, meta, y),
    ebit: toUsd(year.ebit, meta, y),
    tax: toUsd(year.tax, meta, y),
    netProfit: toUsd(year.netProfit, meta, y),
    costPerStudent: toUsd(year.costPerStudent, meta, y),
    cashCollected: toUsd(year.cashCollected, meta, y),
    cashCostsPaid: toUsd(year.cashCostsPaid, meta, y),
    capexSpend: toUsd(year.capexSpend, meta, y),
    taxPaid: toUsd(year.taxPaid, meta, y),
    netCashMovement: toUsd(year.netCashMovement, meta, y),
    closingCash: toUsd(year.closingCash, meta, y),
    opexByGroup: mapMoneyRecord(year.opexByGroup, meta, y),
  }
}

export function costForecastToDisplay(forecast: CostForecast, meta: ProjectMeta, showUsd: boolean): CostForecast {
  if (!showUsd) return forecast
  const years = forecast.years.map((year) => convertYearStatement(year, meta))
  const payroll = forecast.payroll.map((year) => convertYearPayroll(year, meta))
  const closingBalances = years.map((y) => y.closingCash)
  const cashLowPoint = closingBalances.length > 0 ? Math.min(...closingBalances) : 0
  return {
    years,
    payroll,
    breakEvenYearIndex: forecast.breakEvenYearIndex,
    cashLowPoint,
    peakFundingRequirement: cashLowPoint < 0 ? -cashLowPoint : 0,
    totals: {
      netRevenue: years.reduce((sum, y) => sum + y.netRevenue, 0),
      payroll: years.reduce((sum, y) => sum + y.payroll, 0),
      opex: years.reduce((sum, y) => sum + y.opex, 0),
      netProfit: years.reduce((sum, y) => sum + y.netProfit, 0),
    },
  }
}

function convertLoanYear(loan: LoanYear, meta: ProjectMeta): LoanYear {
  const y = loan.yearIndex
  return {
    ...loan,
    opening: toUsd(loan.opening, meta, y),
    drawdown: toUsd(loan.drawdown, meta, y),
    interest: toUsd(loan.interest, meta, y),
    principalRepaid: toUsd(loan.principalRepaid, meta, y),
    closing: toUsd(loan.closing, meta, y),
  }
}

function convertYearCapital(year: YearCapital, meta: ProjectMeta): YearCapital {
  const y = year.yearIndex
  return {
    ...year,
    ebit: toUsd(year.ebit, meta, y),
    interest: toUsd(year.interest, meta, y),
    profitBeforeTax: toUsd(year.profitBeforeTax, meta, y),
    tax: toUsd(year.tax, meta, y),
    netProfit: toUsd(year.netProfit, meta, y),
    dividend: toUsd(year.dividend, meta, y),
    operatingCash: toUsd(year.operatingCash, meta, y),
    capexSpend: toUsd(year.capexSpend, meta, y),
    drawdowns: toUsd(year.drawdowns, meta, y),
    principalRepaid: toUsd(year.principalRepaid, meta, y),
    equityInjected: toUsd(year.equityInjected, meta, y),
    netCashMovement: toUsd(year.netCashMovement, meta, y),
    closingCash: toUsd(year.closingCash, meta, y),
    fixedAssetsNet: toUsd(year.fixedAssetsNet, meta, y),
    receivables: toUsd(year.receivables, meta, y),
    totalAssets: toUsd(year.totalAssets, meta, y),
    payables: toUsd(year.payables, meta, y),
    debt: toUsd(year.debt, meta, y),
    totalLiabilities: toUsd(year.totalLiabilities, meta, y),
    shareCapital: toUsd(year.shareCapital, meta, y),
    retainedEarnings: toUsd(year.retainedEarnings, meta, y),
    totalEquity: toUsd(year.totalEquity, meta, y),
    balanceCheck: toUsd(year.balanceCheck, meta, y),
  }
}

export function capitalForecastToDisplay(
  forecast: CapitalForecast,
  meta: ProjectMeta,
  showUsd: boolean,
): CapitalForecast {
  if (!showUsd) return forecast
  const years = forecast.years.map((year) => convertYearCapital(year, meta))
  const loans = Object.fromEntries(
    Object.entries(forecast.loans).map(([id, schedule]) => [id, schedule.map((year) => convertLoanYear(year, meta))]),
  )
  const freeCashFlows = forecast.valuation.freeCashFlows.map((value, i) => toUsd(value, meta, i))
  const debts = years.map((y) => y.debt)
  const closingCashSeries = years.map((y) => y.closingCash)

  return {
    years,
    loans,
    valuation: {
      freeCashFlows,
      terminalValue: toUsd(forecast.valuation.terminalValue, meta, 0),
      enterpriseValue: toUsd(forecast.valuation.enterpriseValue, meta, 0),
      netDebt: toUsd(forecast.valuation.netDebt, meta, 0),
      equityValue: toUsd(forecast.valuation.equityValue, meta, 0),
      npv: toUsd(forecast.valuation.npv, meta, 0),
      irrPct: forecast.valuation.irrPct,
      paybackYearIndex: forecast.valuation.paybackYearIndex,
    },
    peakDebt: debts.length > 0 ? Math.max(0, ...debts) : 0,
    minimumCash: closingCashSeries.length > 0 ? Math.min(...closingCashSeries) : 0,
  }
}
