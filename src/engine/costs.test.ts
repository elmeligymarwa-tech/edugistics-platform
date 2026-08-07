import { describe, it, expect } from 'vitest'
import { ProjectSchema, type Project } from '../domain/schema'
import { CostModelSchema, type CostModel } from '../domain/costs'
import {
  computeCostForecast,
  computePayroll,
  computeDepreciation,
  derivedTeachingHeadcount,
} from './costs'

function makeProject(overrides: Record<string, unknown> = {}): Project {
  return ProjectSchema.parse({
    id: 'test',
    schemaVersion: 1,
    meta: {
      schoolName: 'Test School',
      logoBase64: null,
      country: 'Egypt',
      currencyCode: 'EGP',
      currencySymbol: 'E£',
      decimalPlaces: 0,
      locale: 'en-GB',
    },
    calendar: {
      academicYearStart: 2027,
      financialYearStartMonth: 9,
      forecastYears: 1,
      termsPerYear: 3,
    },
    yearGroups: ['Y1'],
    capacity: {
      Y1: {
        classrooms: 2,
        studentsPerClassroom: 20,
        teachers: 2,
        teachingAssistants: 2,
        coTeachers: 0,
        maxCapacityPct: 100,
        occupancyPctByYear: [100],
      },
    },
    fees: {
      categories: [
        {
          id: 'tuition',
          name: 'Tuition',
          mandatory: true,
          uptakePct: 100,
          includedInStm: false,
          discountable: true,
          taxTreatment: 'exempt',
          billingFrequency: 'termly',
          chargeBasis: 'perStudent',
          escalationGroup: 'tuition',
        },
      ],
      amounts: { Y1: { tuition: 100000 } },
    },
    revenueAssumptions: {
      enrolmentModel: 'occupancy',
      tuitionEscalationPct: 0,
      otherFeeEscalationPct: 0,
      newIntake: {},
      retentionPct: {},
      progression: true,
      avgSiblingsPerFamily: 1,
      discounts: {
        siblingPct: 0,
        siblingEligiblePct: 0,
        staffChildPct: 0,
        staffChildPlaces: 0,
        scholarshipPct: 0,
        scholarshipPlaces: 0,
        earlyPaymentPct: 0,
        earlyPaymentTakeUpPct: 0,
      },
      collections: { termSplit: [100], payInFullPct: 100, badDebtPct: 0, dsoDays: 0 },
      taxRatePct: 0,
    },
    staffing: {
      positions: [
        {
          id: 'teacher',
          title: 'Teacher',
          section: 'teaching',
          derivedFromCapacity: true,
          manualOverride: false,
          headcount: 0,
          averageSalary: 20000,
          minimumSalary: 0,
          maximumSalary: 0,
          annualIncrementPct: 0,
          employerTaxPct: 0,
          nationalInsurancePct: 0,
          medicalInsurancePct: 0,
          pensionPct: 0,
          housingAllowance: 0,
          transportAllowance: 0,
          recruitmentCost: 0,
          trainingCost: 0,
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
    projectId: 'test',
    schemaVersion: 1,
    payroll: { derivedRoleMap: { teacher: 'teachers' } },
    opex: [],
    capex: [],
    financing: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

describe('headcount', () => {
  it('derives teaching headcount from capacity, not from the staffing step', () => {
    expect(derivedTeachingHeadcount(makeProject())).toEqual({
      teachers: 2,
      teachingAssistants: 2,
      coTeachers: 0,
    })
  })

  it('uses the manual figure when a position is overridden', () => {
    const project = makeProject({
      staffing: {
        positions: [
          {
            ...makeProject().staffing.positions[0]!,
            manualOverride: true,
            headcount: 7,
          },
        ],
      },
    })
    expect(computePayroll(project, makeCost())[0]!.headcount).toBe(7)
  })
})

describe('headcount scaling', () => {
  it('opens classes with enrolment instead of staffing full capacity on day one', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
      capacity: {
        Y1: {
          classrooms: 4,
          studentsPerClassroom: 25,
          teachers: 4,
          teachingAssistants: 0,
          coTeachers: 0,
          maxCapacityPct: 100,
          occupancyPctByYear: [25, 50, 100],
        },
      },
    })
    const payroll = computePayroll(project, makeCost())
    // 25 students needs 1 class of 4, 50 needs 2, 100 needs all 4.
    expect(payroll.map((p) => p.headcount)).toEqual([1, 2, 4])
  })
})

describe('establishment plan', () => {
  it('follows an explicit headcount per year ahead of any other source', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
    })
    const cost = makeCost({
      payroll: {
        derivedRoleMap: { teacher: 'teachers' },
        headcountByYear: { teacher: [1, 3, 6] },
      },
    })
    const payroll = computePayroll(project, cost)
    expect(payroll.map((p) => p.headcount)).toEqual([1, 3, 6])
    expect(payroll[1]!.salaries).toBe(720_000)
  })

  it('holds the final planned year when the plan is shorter than the forecast', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 5, termsPerYear: 3 },
    })
    const cost = makeCost({ payroll: { headcountByYear: { teacher: [2, 4] } } })
    expect(computePayroll(project, cost).map((p) => p.headcount)).toEqual([2, 4, 4, 4, 4])
  })
})

describe('payroll', () => {
  it('matches a hand calculation: 2 teachers x 20,000 a month x 12 = 480,000', () => {
    expect(computePayroll(makeProject(), makeCost())[0]!.total).toBe(480_000)
  })

  it('adds employer on-costs on top of salary', () => {
    const project = makeProject({
      staffing: {
        positions: [
          {
            ...makeProject().staffing.positions[0]!,
            employerTaxPct: 10,
            pensionPct: 5,
            housingAllowance: 20000,
          },
        ],
      },
    })
    const year = computePayroll(project, makeCost())[0]!
    expect(year.salaries).toBe(480_000)
    expect(year.allowances).toBe(40_000)
    expect(year.onCosts).toBeCloseTo(72_000, 6)
    expect(year.total).toBeCloseTo(592_000, 6)
  })

  it('charges recruitment on growth and turnover only', () => {
    const project = makeProject({
      staffing: {
        positions: [
          { ...makeProject().staffing.positions[0]!, recruitmentCost: 10000 },
        ],
      },
    })
    const cost = makeCost({
      payroll: { derivedRoleMap: { teacher: 'teachers' }, turnoverPct: 50 },
    })
    // Year one hires the whole team of 2, plus 50% turnover of 2 = 1. Three hires.
    expect(computePayroll(project, cost)[0]!.recruitment).toBeCloseTo(30_000, 6)
  })
})

describe('contract length and inflation', () => {
  it('prices a ten month contract as monthly salary times ten months', () => {
    const project = makeProject({
      staffing: {
        positions: [
          { ...makeProject().staffing.positions[0]!, monthsWorked: 10 },
        ],
      },
    })
    expect(computePayroll(project, makeCost())[0]!.salaries).toBeCloseTo(400_000, 6)
  })

  it('inherits the model wide inflation rate where a category sets none', () => {
    const cost = makeCost({
      inflationPct: 10,
      opex: [
        { id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 1_000_000, stepSizeStudents: 50, escalationPct: null, startYearIndex: 0, endYearIndex: null },
      ],
    })
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
    })
    const years = computeCostForecast(project, cost).years
    expect(years[0]!.opex).toBeCloseTo(1_000_000, 6)
    expect(years[2]!.opex).toBeCloseTo(1_000_000 * 1.21, 6)
  })
})

describe('stepped costs', () => {
  it('buys a whole unit each time the threshold is crossed', () => {
    const cost = makeCost({
      opex: [
        { id: 'bus', name: 'Bus', group: 'transport', basis: 'stepped', amount: 300_000, stepSizeStudents: 40, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
      ],
    })
    // 40 students at 100 per cent occupancy needs one bus.
    expect(computeCostForecast(makeProject(), cost).years[0]!.opex).toBe(300_000)
  })
})

describe('depreciation', () => {
  it('spreads capex straight line and stops at the end of useful life', () => {
    const cost = makeCost({
      capex: [
        { id: 'fitout', name: 'Fit out', amount: 1_000_000, yearIndex: 0, usefulLifeYears: 5, method: 'straightLine' },
      ],
    })
    expect(computeDepreciation(cost, 10)).toEqual([
      200_000, 200_000, 200_000, 200_000, 200_000, 0, 0, 0, 0, 0,
    ])
  })
})

describe('opex', () => {
  it('applies each basis against the right driver', () => {
    const cost = makeCost({
      opex: [
        { id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 500_000, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
        { id: 'books', name: 'Books', group: 'academic', basis: 'perStudent', amount: 1_000, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
        { id: 'mkt', name: 'Marketing', group: 'marketing', basis: 'pctOfRevenue', amount: 5, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
      ],
    })
    const year = computeCostForecast(makeProject(), cost).years[0]!
    // 500,000 fixed + 40 students x 1,000 + 5% of 4,000,000
    expect(year.opex).toBeCloseTo(500_000 + 40_000 + 200_000, 6)
    expect(year.opexByGroup.facilities).toBe(500_000)
  })

  it('ignores a category outside its start and end window', () => {
    const cost = makeCost({
      opex: [
        { id: 'late', name: 'Late', group: 'other', basis: 'fixed', amount: 100_000, escalationPct: 0, startYearIndex: 2, endYearIndex: null },
      ],
    })
    expect(computeCostForecast(makeProject(), cost).years[0]!.opex).toBe(0)
  })
})

describe('statements', () => {
  it('produces a P&L that ties from revenue down to net profit', () => {
    const cost = makeCost({
      opex: [
        { id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 1_000_000, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
      ],
      capex: [
        { id: 'fitout', name: 'Fit out', amount: 1_000_000, yearIndex: 0, usefulLifeYears: 5, method: 'straightLine' },
      ],
      financing: { openingCash: 0, payablesDays: 0, corporateTaxPct: 20, carryLossesForward: true },
    })
    const year = computeCostForecast(makeProject(), cost).years[0]!
    // 4,000,000 revenue less 480,000 payroll less 1,000,000 rent = 2,520,000 EBITDA
    expect(year.ebitda).toBeCloseTo(2_520_000, 6)
    expect(year.depreciation).toBeCloseTo(200_000, 6)
    expect(year.ebit).toBeCloseTo(2_320_000, 6)
    expect(year.tax).toBeCloseTo(464_000, 6)
    expect(year.netProfit).toBeCloseTo(1_856_000, 6)
    expect(year.ebitdaMarginPct).toBeCloseTo(63, 6)
  })

  it('carries losses forward against later taxable profit', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
      capacity: {
        Y1: {
          classrooms: 2,
          studentsPerClassroom: 20,
          teachers: 2,
          teachingAssistants: 0,
          coTeachers: 0,
          maxCapacityPct: 100,
          occupancyPctByYear: [10, 100, 100],
        },
      },
    })
    const cost = makeCost({
      opex: [
        { id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 1_000_000, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
      ],
      financing: { openingCash: 0, payablesDays: 0, corporateTaxPct: 20, carryLossesForward: true },
    })
    const years = computeCostForecast(project, cost).years
    // Year one loses money, so no tax and the loss carries into year two.
    expect(years[0]!.netProfit).toBeLessThan(0)
    expect(years[0]!.tax).toBe(0)
    expect(years[1]!.tax).toBeLessThan(years[2]!.tax)
  })

  it('reports break even and the peak funding requirement', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
      capacity: {
        Y1: {
          classrooms: 2,
          studentsPerClassroom: 20,
          teachers: 2,
          teachingAssistants: 0,
          coTeachers: 0,
          maxCapacityPct: 100,
          occupancyPctByYear: [10, 60, 100],
        },
      },
    })
    const cost = makeCost({
      opex: [
        { id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 1_500_000, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
      ],
    })
    const result = computeCostForecast(project, cost)
    expect(result.breakEvenYearIndex).toBe(1)
    expect(result.peakFundingRequirement).toBeGreaterThan(0)
  })

  it('defers cash costs by payables days into the following year', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
    })
    const cost = makeCost({
      financing: { openingCash: 0, payablesDays: 365, corporateTaxPct: 0, carryLossesForward: true },
    })
    const years = computeCostForecast(project, cost).years
    expect(years[0]!.cashCostsPaid).toBe(0)
    expect(years[1]!.cashCostsPaid).toBeCloseTo(480_000, 6)
  })

  it('returns zeroes for an empty cost model without throwing', () => {
    const result = computeCostForecast(makeProject(), makeCost())
    expect(result.years[0]!.opex).toBe(0)
    expect(result.years[0]!.netProfit).toBeCloseTo(3_520_000, 6)
  })
})
