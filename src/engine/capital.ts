import type { Project } from '../domain/schema'
import type { CostModel } from '../domain/costs'
import type { CapitalModel, Loan } from '../domain/capital'
import { computeCostForecast, type CostForecast } from './costs'

/**
 * Version 3 engine. Debt schedules, a balance sheet that ties, and valuation.
 * Pure functions, no React, no I/O.
 */

export interface LoanYear {
  yearIndex: number
  opening: number
  drawdown: number
  interest: number
  principalRepaid: number
  closing: number
}

export interface YearCapital {
  yearIndex: number
  label: string
  /* profit and loss below EBIT */
  ebit: number
  interest: number
  profitBeforeTax: number
  tax: number
  netProfit: number
  dividend: number
  /* cash flow */
  operatingCash: number
  capexSpend: number
  drawdowns: number
  principalRepaid: number
  equityInjected: number
  netCashMovement: number
  closingCash: number
  /* balance sheet */
  fixedAssetsNet: number
  receivables: number
  totalAssets: number
  payables: number
  debt: number
  totalLiabilities: number
  shareCapital: number
  retainedEarnings: number
  totalEquity: number
  balanceCheck: number
}

export interface CapitalForecast {
  years: YearCapital[]
  loans: Record<string, LoanYear[]>
  valuation: {
    freeCashFlows: number[]
    terminalValue: number
    enterpriseValue: number
    netDebt: number
    equityValue: number
    npv: number
    irrPct: number | null
    paybackYearIndex: number | null
  }
  peakDebt: number
  minimumCash: number
}

/* ------------------------------------------------------------------ debt */

export function buildLoanSchedule(loan: Loan, years: number): LoanYear[] {
  const schedule: LoanYear[] = []
  const rate = loan.interestRatePct / 100
  // A grace period at or beyond the term would leave no year in which sinceDraw is both
  // past grace and still within the term, so the loan would draw down and accrue interest
  // but never repay — clamp to always leave at least one repayment year.
  const graceYears = Math.min(loan.graceYears, Math.max(0, loan.termYears - 1))
  const repayYears = Math.max(1, loan.termYears - graceYears)
  let balance = 0

  for (let y = 0; y < years; y += 1) {
    const opening = balance
    const drawdown = y === loan.drawYearIndex ? loan.principal : 0
    balance += drawdown

    const interest = (opening + drawdown * 0.5) * rate

    let principalRepaid = 0
    const sinceDraw = y - loan.drawYearIndex
    const repaying = sinceDraw >= graceYears && sinceDraw < loan.termYears

    if (repaying && balance > 0) {
      if (loan.repaymentType === 'bullet') {
        principalRepaid = sinceDraw === loan.termYears - 1 ? balance : 0
      } else if (loan.repaymentType === 'straightLine') {
        principalRepaid = Math.min(balance, loan.principal / repayYears)
      } else {
        const n = repayYears
        const payment =
          rate > 0
            ? (loan.principal * rate) / (1 - (1 + rate) ** -n)
            : loan.principal / n
        principalRepaid = Math.min(balance, Math.max(0, payment - interest))
      }
    }

    balance -= principalRepaid
    schedule.push({
      yearIndex: y,
      opening,
      drawdown,
      interest,
      principalRepaid,
      closing: balance,
    })
  }

  return schedule
}

/* -------------------------------------------------------------- valuation */

export function irr(cashflows: number[], guess = 0.15): number | null {
  const npvAt = (r: number) =>
    cashflows.reduce((sum, cf, i) => sum + cf / (1 + r) ** i, 0)

  let low = -0.9
  let high = 10
  if (npvAt(low) * npvAt(high) > 0) return null

  let mid = guess
  for (let i = 0; i < 200; i += 1) {
    mid = (low + high) / 2
    const v = npvAt(mid)
    if (Math.abs(v) < 1e-6) break
    if (npvAt(low) * v < 0) high = mid
    else low = mid
  }
  return mid
}

export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((sum, cf, i) => sum + cf / (1 + rate) ** i, 0)
}

/* ---------------------------------------------------------------- master */

export function computeCapitalForecast(
  project: Project,
  cost: CostModel,
  capital: CapitalModel,
  costs?: CostForecast,
): CapitalForecast {
  const base = costs ?? computeCostForecast(project, cost)
  const years = base.years.length

  const loanSchedules: Record<string, LoanYear[]> = {}
  for (const loan of capital.loans) {
    loanSchedules[loan.id] = buildLoanSchedule(loan, years)
  }

  const taxRate = cost.financing.corporateTaxPct / 100
  const out: YearCapital[] = []

  let cash = cost.financing.openingCash
  let receivables = 0
  let payables = 0
  let fixedAssets = capital.openingFixedAssets
  let retained = 0
  let shareCapital = capital.equity.openingShareCapital
  let lossesCarried = 0

  for (let y = 0; y < years; y += 1) {
    const s = base.years[y]!

    const interest = capital.loans.reduce(
      (sum, l) => sum + (loanSchedules[l.id]?.[y]?.interest ?? 0),
      0,
    )
    const drawdowns = capital.loans.reduce(
      (sum, l) => sum + (loanSchedules[l.id]?.[y]?.drawdown ?? 0),
      0,
    )
    const fees = capital.loans.reduce(
      (sum, l) =>
        sum +
        ((loanSchedules[l.id]?.[y]?.drawdown ?? 0) * l.arrangementFeePct) / 100,
      0,
    )
    const principalRepaid = capital.loans.reduce(
      (sum, l) => sum + (loanSchedules[l.id]?.[y]?.principalRepaid ?? 0),
      0,
    )

    const profitBeforeTax = s.ebit - interest - fees

    let taxable = profitBeforeTax
    if (cost.financing.carryLossesForward) {
      taxable = profitBeforeTax - lossesCarried
      if (taxable < 0) {
        lossesCarried = -taxable
        taxable = 0
      } else {
        lossesCarried = 0
      }
    }
    const tax = Math.max(0, taxable) * taxRate
    const netProfit = profitBeforeTax - tax

    /* working capital balances, derived from the cost forecast */
    const closingReceivables = receivables + s.netRevenue - s.cashCollected
    const cashCosts = s.payroll + s.opex + s.stm
    const closingPayables = payables + cashCosts - s.cashCostsPaid

    const equityInjected = capital.equity.injections
      .filter((i) => i.yearIndex === y)
      .reduce((sum, i) => sum + i.amount, 0)

    const operatingCash = s.cashCollected - s.cashCostsPaid - tax - interest - fees

    const dividend =
      retained + netProfit > 0
        ? Math.max(0, netProfit) * (capital.equity.dividendPayoutPct / 100)
        : 0

    const netCashMovement =
      operatingCash -
      s.capexSpend +
      drawdowns -
      principalRepaid +
      equityInjected -
      dividend

    cash += netCashMovement
    receivables = closingReceivables
    payables = closingPayables
    fixedAssets += s.capexSpend - s.depreciation
    retained += netProfit - dividend
    shareCapital += equityInjected

    const debt = capital.loans.reduce(
      (sum, l) => sum + (loanSchedules[l.id]?.[y]?.closing ?? 0),
      0,
    )

    const totalAssets = fixedAssets + receivables + cash
    const totalLiabilities = payables + debt
    const totalEquity = shareCapital + retained

    out.push({
      yearIndex: y,
      label: s.label,
      ebit: s.ebit,
      interest: interest + fees,
      profitBeforeTax,
      tax,
      netProfit,
      dividend,
      operatingCash,
      capexSpend: s.capexSpend,
      drawdowns,
      principalRepaid,
      equityInjected,
      netCashMovement,
      closingCash: cash,
      fixedAssetsNet: fixedAssets,
      receivables,
      totalAssets,
      payables,
      debt,
      totalLiabilities,
      shareCapital,
      retainedEarnings: retained,
      totalEquity,
      balanceCheck: totalAssets - totalLiabilities - totalEquity,
    })
  }

  /* ------------------------------------------------------------ valuation */

  const wacc = capital.valuation.discountRatePct / 100
  const g = capital.valuation.terminalGrowthPct / 100

  const freeCashFlows: number[] = []
  let priorWorkingCapital = 0
  for (let y = 0; y < years; y += 1) {
    const s = base.years[y]!
    const c = out[y]!
    const workingCapital = c.receivables - c.payables
    const deltaWc = workingCapital - priorWorkingCapital
    priorWorkingCapital = workingCapital
    const taxOnEbit = Math.max(0, s.ebit) * taxRate
    freeCashFlows.push(s.ebitda - taxOnEbit - s.capexSpend - deltaWc)
  }

  const finalFcf = freeCashFlows[years - 1] ?? 0
  const finalEbitda = base.years[years - 1]?.ebitda ?? 0
  const terminalValue =
    capital.valuation.method === 'exitMultiple'
      ? finalEbitda * capital.valuation.exitEbitdaMultiple
      : wacc > g
        ? (finalFcf * (1 + g)) / (wacc - g)
        : 0

  const discounted = freeCashFlows.map((cf, i) => cf / (1 + wacc) ** (i + 1))
  const pvTerminal = terminalValue / (1 + wacc) ** years
  const enterpriseValue = discounted.reduce((a, b) => a + b, 0) + pvTerminal

  const closing = out[years - 1]
  const netDebt = (closing?.debt ?? 0) - (closing?.closingCash ?? 0)
  const equityValue = enterpriseValue - netDebt

  /**
   * NPV, IRR and payback are the equity investor's return, not the whole project's — the
   * initial outlay below is the equity stake, so what follows it must be cash flow that
   * actually reaches equity (dividends paid out, net of any further injections called),
   * with the equity's own share of the exit (enterprise value less outstanding net debt)
   * added in the final year. Using the unlevered project cash flows or the enterprise
   * terminal value here would credit the equity investor with value that belongs to the
   * school's lenders, overstating both the return and the enterprise value included in it.
   */
  const openingEquityOutlay = capital.equity.openingShareCapital || cost.financing.openingCash
  const equityCashFlows = out.map((year) => year.dividend - year.equityInjected)
  const finalEquityCashFlowIndex = equityCashFlows.length - 1
  if (finalEquityCashFlowIndex >= 0) {
    equityCashFlows[finalEquityCashFlowIndex] =
      (equityCashFlows[finalEquityCashFlowIndex] ?? 0) + equityValue
  }
  const irrSeries = [-openingEquityOutlay, ...equityCashFlows]

  let cumulative = -openingEquityOutlay
  let paybackYearIndex: number | null = null
  for (let y = 0; y < equityCashFlows.length; y += 1) {
    cumulative += equityCashFlows[y] ?? 0
    if (cumulative >= 0 && paybackYearIndex === null) paybackYearIndex = y
  }

  const irrValue = irr(irrSeries)

  return {
    years: out,
    loans: loanSchedules,
    valuation: {
      freeCashFlows,
      terminalValue,
      enterpriseValue,
      netDebt,
      equityValue,
      npv: equityValue - (capital.equity.openingShareCapital || 0),
      irrPct: irrValue === null ? null : irrValue * 100,
      paybackYearIndex,
    },
    peakDebt: Math.max(0, ...out.map((y) => y.debt)),
    minimumCash: Math.min(...out.map((y) => y.closingCash)),
  }
}
