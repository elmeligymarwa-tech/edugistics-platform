import { describe, it, expect } from 'vitest'
import { ProjectSchema, type Project } from '../domain/schema'
import { CostModelSchema, type CostModel } from '../domain/costs'
import { CapitalModelSchema, type CapitalModel } from '../domain/capital'
import { buildLoanSchedule, computeCapitalForecast, irr, npv } from './capital'

function makeProject(overrides: Record<string, unknown> = {}): Project {
  return ProjectSchema.parse({
    id: 'test',
    schemaVersion: 1,
    meta: {
      schoolName: 'Test School', logoBase64: null, country: 'Egypt',
      currencyCode: 'EGP', currencySymbol: 'E£', decimalPlaces: 0, locale: 'en-GB',
    },
    calendar: {
      academicYearStart: 2027, financialYearStartMonth: 9,
      forecastYears: 5, termsPerYear: 3,
    },
    yearGroups: ['Y1'],
    capacity: {
      Y1: {
        classrooms: 2, studentsPerClassroom: 20, teachers: 2,
        teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
        occupancyPctByYear: [100],
      },
    },
    fees: {
      categories: [
        {
          id: 'tuition', name: 'Tuition', mandatory: true, uptakePct: 100,
          includedInStm: false, discountable: true, taxTreatment: 'exempt',
          billingFrequency: 'termly', chargeBasis: 'perStudent',
          escalationGroup: 'tuition',
        },
      ],
      amounts: { Y1: { tuition: 100000 } },
    },
    revenueAssumptions: {
      tuitionEscalationPct: 0, otherFeeEscalationPct: 0,
      intakeGrowthRatePct: 0, intakeOverrides: {},
      discounts: {
        staffChildPct: 0, staffChildPlaces: 0,
        scholarshipPct: 0, scholarshipPlaces: 0, earlyPaymentPct: 0,
        earlyPaymentTakeUpPct: 0,
      },
      collections: { termSplit: [50, 30, 20], payInFullPct: 0, badDebtPct: 0, dsoDays: 60 },
      taxRatePct: 0,
    },
    staffing: {
      positions: [
        {
          id: 'teacher', title: 'Teacher', section: 'teaching',
          derivedFromCapacity: true, manualOverride: false, headcount: 0,
          averageSalary: 200000, minimumSalary: 0, maximumSalary: 0,
          annualIncrementPct: 0, employerTaxPct: 0, nationalInsurancePct: 0,
          medicalInsurancePct: 0, pensionPct: 0, housingAllowance: 0,
          transportAllowance: 0, recruitmentCost: 0, trainingCost: 0,
        },
      ],
    },
    stm: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

function makeCost(overrides: Record<string, unknown> = {}): CostModel {
  return CostModelSchema.parse({
    projectId: 'test', schemaVersion: 1,
    payroll: { derivedRoleMap: { teacher: 'teachers' } },
    opex: [
      { id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 1_000_000, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
    ],
    capex: [
      { id: 'fitout', name: 'Fit out', amount: 5_000_000, yearIndex: 0, usefulLifeYears: 5, method: 'straightLine' },
    ],
    financing: { openingCash: 3_000_000, payablesDays: 45, corporateTaxPct: 20, carryLossesForward: true },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

function makeCapital(overrides: Record<string, unknown> = {}): CapitalModel {
  return CapitalModelSchema.parse({
    projectId: 'test', schemaVersion: 1,
    /** Opening equity must match opening cash plus opening fixed assets. */
    equity: { openingShareCapital: 3_000_000, injections: [], dividendPayoutPct: 0 },
    loans: [],
    valuation: { discountRatePct: 15, terminalGrowthPct: 3, method: 'perpetuity', exitEbitdaMultiple: 8 },
    openingFixedAssets: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

describe('loan schedules', () => {
  const loan = {
    id: 'l1', name: 'Term loan', principal: 1_000_000, drawYearIndex: 0,
    interestRatePct: 10, termYears: 5, graceYears: 0,
    repaymentType: 'straightLine' as const, arrangementFeePct: 0,
  }

  it('repays straight line and clears the balance by the end of the term', () => {
    const s = buildLoanSchedule(loan, 6)
    expect(s[0]!.drawdown).toBe(1_000_000)
    expect(s[0]!.principalRepaid).toBe(200_000)
    expect(s[4]!.closing).toBeCloseTo(0, 6)
    expect(s[5]!.interest).toBe(0)
  })

  it('pays interest only during the grace period', () => {
    const s = buildLoanSchedule({ ...loan, graceYears: 2 }, 6)
    expect(s[0]!.principalRepaid).toBe(0)
    expect(s[1]!.principalRepaid).toBe(0)
    expect(s[2]!.principalRepaid).toBeGreaterThan(0)
    expect(s[1]!.interest).toBeCloseTo(100_000, 6)
  })

  it('repays a bullet loan in a single payment at the end', () => {
    const s = buildLoanSchedule({ ...loan, repaymentType: 'bullet' }, 6)
    expect(s[3]!.principalRepaid).toBe(0)
    expect(s[4]!.principalRepaid).toBe(1_000_000)
    expect(s[4]!.closing).toBe(0)
  })

  it('keeps an annuity payment level across the term', () => {
    const s = buildLoanSchedule({ ...loan, repaymentType: 'annuity' }, 5)
    const payments = s.map((y) => y.interest + y.principalRepaid)
    expect(payments[0]!).toBeCloseTo(payments[3]!, -3)
    expect(s[4]!.closing).toBeCloseTo(0, 2)
  })

  it('still fully repays within the term when the grace period is misconfigured to reach it', () => {
    // graceYears >= termYears would otherwise leave no year where sinceDraw is both past
    // grace and still inside the term, so the loan would draw down, accrue interest, and
    // never repay a cent — the schedule must clamp grace so at least one year repays.
    const s = buildLoanSchedule({ ...loan, termYears: 5, graceYears: 5 }, 6)
    expect(s.some((year) => year.principalRepaid > 0)).toBe(true)
    expect(s[4]!.closing).toBeCloseTo(0, 6)
  })
})

describe('balance sheet', () => {
  it('ties in every year with no debt', () => {
    const result = computeCapitalForecast(makeProject(), makeCost(), makeCapital())
    for (const y of result.years) {
      expect(Math.abs(y.balanceCheck)).toBeLessThan(0.01)
    }
  })

  it('ties in every year with debt, equity injections and dividends', () => {
    const capital = makeCapital({
      equity: {
        openingShareCapital: 3_000_000,
        injections: [{ id: 'r1', label: 'Round A', amount: 2_000_000, yearIndex: 1 }],
        dividendPayoutPct: 30,
      },
      loans: [
        {
          id: 'l1', name: 'Term loan', principal: 4_000_000, drawYearIndex: 0,
          interestRatePct: 12, termYears: 5, graceYears: 1,
          repaymentType: 'annuity', arrangementFeePct: 1,
        },
      ],
    })
    const result = computeCapitalForecast(makeProject(), makeCost(), capital)
    for (const y of result.years) {
      expect(Math.abs(y.balanceCheck)).toBeLessThan(0.01)
    }
    expect(result.peakDebt).toBeGreaterThan(0)
  })

  it('reduces net profit by loan interest', () => {
    const withoutDebt = computeCapitalForecast(makeProject(), makeCost(), makeCapital())
    const withDebt = computeCapitalForecast(
      makeProject(),
      makeCost(),
      makeCapital({
        loans: [
          {
            id: 'l1', name: 'Term loan', principal: 4_000_000, drawYearIndex: 0,
            interestRatePct: 10, termYears: 5, graceYears: 0,
            repaymentType: 'straightLine', arrangementFeePct: 0,
          },
        ],
      }),
    )
    expect(withDebt.years[0]!.interest).toBeCloseTo(200_000, 6)
    expect(withDebt.years[0]!.netProfit).toBeLessThan(withoutDebt.years[0]!.netProfit)
  })
})

describe('valuation', () => {
  it('discounts a known cash flow series correctly', () => {
    expect(npv(0.1, [-1000, 500, 500, 500])).toBeCloseTo(243.43, 1)
  })

  it('finds the internal rate of return on a simple series', () => {
    const r = irr([-1000, 500, 500, 500])
    expect(r).not.toBeNull()
    expect((r as number) * 100).toBeCloseTo(23.38, 1)
  })

  it('returns an enterprise value, equity value and IRR', () => {
    const result = computeCapitalForecast(makeProject(), makeCost(), makeCapital())
    expect(result.valuation.enterpriseValue).toBeGreaterThan(0)
    expect(result.valuation.terminalValue).toBeGreaterThan(0)
    expect(result.valuation.irrPct).not.toBeNull()
    expect(result.valuation.equityValue).toBeGreaterThan(
      result.valuation.enterpriseValue - 1e9,
    )
  })

  it('bases NPV on equity value, not enterprise value, once there is debt to net off', () => {
    const result = computeCapitalForecast(
      makeProject(),
      makeCost(),
      makeCapital({
        loans: [
          {
            id: 'l1', name: 'Term loan', principal: 4_000_000, drawYearIndex: 0,
            interestRatePct: 10, termYears: 5, graceYears: 0,
            repaymentType: 'straightLine', arrangementFeePct: 0,
          },
        ],
      }),
    )
    const { npv: reportedNpv, equityValue, enterpriseValue } = result.valuation
    expect(result.valuation.netDebt).not.toBe(0)
    // The equity investor's NPV nets off outstanding debt via equityValue — crediting
    // enterprise value (which still belongs partly to the lender) would overstate it.
    expect(reportedNpv).toBeCloseTo(equityValue - 3_000_000, 6)
    expect(reportedNpv).not.toBeCloseTo(enterpriseValue - 3_000_000, 6)
  })

  it('computes IRR from cash actually paid to equity, not the unlevered project cash flow', () => {
    // A single forecast year with every profit paid out as a dividend makes the equity
    // cash flow series exactly [-openingShareCapital, dividend + equityValue] — a
    // two-flow series whose IRR has an exact closed form, so this checks the wiring
    // (dividends plus the equity's own share of the exit) rather than approximating it.
    const project = makeProject({ calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 1, termsPerYear: 3 } })
    // No capex here — a one-off spend dumped into the only forecast year would swamp free
    // cash flow and make the Gordon-growth terminal value (which assumes that year is
    // representative of a steady state) meaningless, which isn't what this test is about.
    const cost = makeCost({ capex: [] })
    const capital = makeCapital({ equity: { openingShareCapital: 3_000_000, injections: [], dividendPayoutPct: 100 } })
    const result = computeCapitalForecast(project, cost, capital)

    const dividend = result.years[0]!.dividend
    expect(dividend).toBeGreaterThan(0)
    const expectedIrrPct = ((dividend + result.valuation.equityValue) / 3_000_000 - 1) * 100
    expect(result.valuation.irrPct).toBeCloseTo(expectedIrrPct, 4)
  })

  it('reports payback against the equity outlay, not an un-netted cash flow total', () => {
    // With no dividends at all (0% payout), no cash reaches the investor until the
    // terminal equity value lands in the final year — payback cannot occur any earlier.
    const project = makeProject({ calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 } })
    const capital = makeCapital({ equity: { openingShareCapital: 3_000_000, injections: [], dividendPayoutPct: 0 } })
    const result = computeCapitalForecast(project, makeCost(), capital)
    expect(result.valuation.paybackYearIndex).toBe(2)
  })

  it('values on an exit multiple when that method is chosen', () => {
    const result = computeCapitalForecast(
      makeProject(),
      makeCost(),
      makeCapital({
        valuation: { discountRatePct: 15, terminalGrowthPct: 3, method: 'exitMultiple', exitEbitdaMultiple: 8 },
      }),
    )
    const finalEbitda = 4_000_000 - 400_000 - 1_000_000
    expect(result.valuation.terminalValue).toBeCloseTo(finalEbitda * 8, 6)
  })

  it('returns no terminal value when growth exceeds the discount rate', () => {
    const result = computeCapitalForecast(
      makeProject(),
      makeCost(),
      makeCapital({
        valuation: { discountRatePct: 5, terminalGrowthPct: 10, method: 'perpetuity', exitEbitdaMultiple: 8 },
      }),
    )
    expect(result.valuation.terminalValue).toBe(0)
  })
})
