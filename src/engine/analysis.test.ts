import { describe, it, expect } from 'vitest'
import { ProjectSchema, type Project } from '../domain/schema'
import { CostModelSchema, type CostModel } from '../domain/costs'
import { CapitalModelSchema, type CapitalModel } from '../domain/capital'
import { exchangeRate, toUsd, validateModel, tornado } from './analysis'

function makeProject(overrides: Record<string, unknown> = {}): Project {
  return ProjectSchema.parse({
    id: 'test', schemaVersion: 1,
    meta: {
      schoolName: 'Test', logoBase64: null, country: 'Egypt',
      currencyCode: 'EGP', currencySymbol: 'E£', decimalPlaces: 0, locale: 'en-GB',
      usdRate: 50, usdRateByYear: [50, 54, 58], feeEscalationCapPct: 10,
    },
    calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
    yearGroups: ['Y1'],
    capacity: {
      Y1: {
        classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0,
        coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 0,
        occupancyPctByYear: [100],
      },
    },
    fees: {
      categories: [{
        id: 'tuition', name: 'Tuition', mandatory: true, uptakePct: 100,
        includedInStm: false, discountable: true, taxTreatment: 'exempt',
        billingFrequency: 'termly', chargeBasis: 'perStudent', escalationGroup: 'tuition',
      }],
      amounts: { Y1: { tuition: 100000 } },
    },
    revenueAssumptions: {
      schoolPlan: { enabled: false, maxSchoolStudents: null, totalStudentsByYear: [], taperPct: 40 },
      schoolOccupancyPctByYear: [],
      tuitionEscalationPct: 8, otherFeeEscalationPct: 8,
      intakeGrowthRatePct: 0, intakeOverrides: {},
      discounts: { staffChildPct: 0, staffChildPlaces: 0, scholarshipPct: 0, scholarshipPlaces: 0, earlyPaymentPct: 0, earlyPaymentTakeUpPct: 0 },
      collections: { termSplit: [100], payInFullPct: 100, badDebtPct: 0, dsoDays: 0 },
      taxRatePct: 0,
    },
    staffing: {
      positions: [{
        id: 'teacher', title: 'Teacher', section: 'teaching', derivedFromCapacity: true,
        manualOverride: false, headcount: 0, averageSalary: 200000, minimumSalary: 0,
        maximumSalary: 0, annualIncrementPct: 0, employerTaxPct: 0, nationalInsurancePct: 0,
        medicalInsurancePct: 0, pensionPct: 0, housingAllowance: 0, transportAllowance: 0,
        recruitmentCost: 0, trainingCost: 0, monthsWorked: 12,
      }],
    },
    stm: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

function makeCost(overrides: Record<string, unknown> = {}): CostModel {
  return CostModelSchema.parse({
    projectId: 'test', schemaVersion: 1, inflationPct: 0,
    payroll: { derivedRoleMap: { teacher: 'teachers' } },
    opex: [{ id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 1000000, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null }],
    capex: [],
    financing: { openingCash: 1000000, payablesDays: 0, corporateTaxPct: 20, carryLossesForward: true },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

function makeCapital(): CapitalModel {
  return CapitalModelSchema.parse({
    projectId: 'test', schemaVersion: 1,
    equity: { openingShareCapital: 1000000, injections: [], dividendPayoutPct: 0 },
    loans: [],
    valuation: { discountRatePct: 15, terminalGrowthPct: 3, method: 'perpetuity', exitEbitdaMultiple: 8 },
    openingFixedAssets: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('currency conversion', () => {
  it('uses the rate entered for each forecast year', () => {
    const meta = makeProject().meta
    expect(exchangeRate(meta, 0)).toBe(50)
    expect(exchangeRate(meta, 1)).toBe(54)
    expect(exchangeRate(meta, 2)).toBe(58)
  })

  it('holds the final entered rate beyond the end of the list', () => {
    const meta = makeProject().meta
    expect(exchangeRate(meta, 9)).toBe(58)
  })

  it('falls back to a flat base rate when no yearly rates are entered', () => {
    const meta = { ...makeProject().meta, usdRateByYear: [] }
    expect(exchangeRate(meta, 5)).toBe(50)
  })

  it('converts a figure at the rate for its year', () => {
    const meta = makeProject().meta
    expect(toUsd(5_000_000, meta, 0)).toBeCloseTo(100_000, 6)
    expect(toUsd(5_400_000, meta, 1)).toBeCloseTo(100_000, 6)
  })
})

describe('model warnings', () => {
  it('stays silent on a sound model', () => {
    expect(validateModel(makeProject(), makeCost())).toEqual([])
  })

  it('flags fee increases above the regulatory cap', () => {
    const warnings = validateModel(
      makeProject({
        revenueAssumptions: {
          ...makeProject().revenueAssumptions,
          tuitionEscalationPct: 15,
        },
      }),
      makeCost(),
    )
    expect(warnings.filter((w) => w.code === 'feeCapBreach').length).toBe(2)
    expect(warnings[0]!.severity).toBe('error')
  })

  it('flags any year where cash falls below zero', () => {
    const warnings = validateModel(
      makeProject(),
      makeCost({
        opex: [{ id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 20000000, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null }],
      }),
    )
    expect(warnings.some((w) => w.code === 'negativeCash')).toBe(true)
  })
})

describe('sensitivity', () => {
  it('ranks drivers by their effect on equity value', () => {
    const result = tornado(makeProject(), makeCost(), makeCapital(), 10)
    expect(result.entries.length).toBeGreaterThan(4)
    for (let i = 1; i < result.entries.length; i += 1) {
      expect(result.entries[i - 1]!.swing).toBeGreaterThanOrEqual(result.entries[i]!.swing)
    }
  })

  it('shows enrolment moving equity value in the expected direction', () => {
    const entry = tornado(makeProject(), makeCost(), makeCapital(), 10).entries.find(
      (e) => e.driver === 'occupancy',
    )
    expect(entry).toBeDefined()
    expect(entry!.high).toBeGreaterThan(entry!.low)
  })

  it('shows a higher discount rate reducing equity value', () => {
    const entry = tornado(makeProject(), makeCost(), makeCapital(), 10).entries.find(
      (e) => e.driver === 'discountRate',
    )
    expect(entry!.high).toBeLessThan(entry!.low)
  })
})
