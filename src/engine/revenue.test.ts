import { describe, it, expect } from 'vitest'
import { ProjectSchema, type Project } from '../domain/schema'
import { computeForecast, computeEnrolment, stmLiability, discountRate } from './revenue'

/** Minimal valid project. Override any branch in the test itself. */
function makeProject(overrides: Record<string, unknown> = {}): Project {
  const base = {
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
          includedInStm: true,
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
      collections: {
        termSplit: [100],
        payInFullPct: 100,
        badDebtPct: 0,
        dsoDays: 0,
      },
      taxRatePct: 0,
    },
    staffing: { positions: [] },
    stm: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return ProjectSchema.parse(base)
}

describe('baseline', () => {
  it('matches a hand calculation: 2 classrooms x 20 students x 100,000 = 4,000,000', () => {
    const forecast = computeForecast(makeProject())
    expect(forecast.years[0]!.students).toBe(40)
    expect(forecast.years[0]!.grossRevenue).toBe(4_000_000)
    expect(forecast.years[0]!.netRevenue).toBe(4_000_000)
  })

  it('returns zeroes for an empty project without throwing', () => {
    const empty = makeProject({
      yearGroups: [],
      capacity: {},
      fees: { categories: [], amounts: {} },
    })
    const forecast = computeForecast(empty)
    expect(forecast.years[0]!.grossRevenue).toBe(0)
    expect(forecast.years[0]!.revenuePerStudent).toBe(0)
    expect(forecast.cagrPct).toBe(0)
  })
})

describe('escalation', () => {
  it('compounds tuition across ten years', () => {
    const project = makeProject({
      calendar: {
        academicYearStart: 2027,
        financialYearStartMonth: 9,
        forecastYears: 10,
        termsPerYear: 3,
      },
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
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        tuitionEscalationPct: 10,
      },
    })
    const forecast = computeForecast(project)
    expect(forecast.years[0]!.grossRevenue).toBeCloseTo(4_000_000, 6)
    expect(forecast.years[9]!.grossRevenue).toBeCloseTo(4_000_000 * 1.1 ** 9, 4)
    expect(forecast.cagrPct).toBeCloseTo(10, 6)
  })
})

describe('enrolment', () => {
  it('applies the occupancy ramp and stops at the capacity ceiling', () => {
    const project = makeProject({
      calendar: {
        academicYearStart: 2027,
        financialYearStartMonth: 9,
        forecastYears: 3,
        termsPerYear: 3,
      },
      capacity: {
        Y1: {
          classrooms: 2,
          studentsPerClassroom: 20,
          teachers: 2,
          teachingAssistants: 2,
          coTeachers: 0,
          maxCapacityPct: 100,
          occupancyPctByYear: [50, 75, 100],
        },
      },
    })
    const enrolment = computeEnrolment(project)
    expect(enrolment.map((y) => y[0]!.students)).toEqual([20, 30, 40])
  })

  it('progresses cohorts and caps at the ceiling in cohort mode', () => {
    const project = makeProject({
      calendar: {
        academicYearStart: 2027,
        financialYearStartMonth: 9,
        forecastYears: 3,
        termsPerYear: 3,
      },
      yearGroups: ['Y1', 'Y2'],
      capacity: {
        Y1: {
          classrooms: 1,
          studentsPerClassroom: 20,
          teachers: 1,
          teachingAssistants: 1,
          coTeachers: 0,
          maxCapacityPct: 100,
          occupancyPctByYear: [100],
        },
        Y2: {
          classrooms: 1,
          studentsPerClassroom: 10,
          teachers: 1,
          teachingAssistants: 1,
          coTeachers: 0,
          maxCapacityPct: 100,
          occupancyPctByYear: [0],
        },
      },
      fees: {
        categories: makeProject().fees.categories,
        amounts: { Y1: { tuition: 100000 }, Y2: { tuition: 100000 } },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        enrolmentModel: 'cohort',
        retentionPct: { Y1: 100, Y2: 90 },
        newIntake: { Y1: [0, 0], Y2: [0, 0] },
      },
    })
    const enrolment = computeEnrolment(project)
    // Y1 fills to 20 in year one. In year two 90% progress into Y2, capped at 10.
    expect(enrolment[0]![0]!.students).toBe(20)
    expect(enrolment[1]![1]!.students).toBe(10)
  })
})

describe('school wide ramp and student caps', () => {
  it('uses one school ramp for every year group when set', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
      yearGroups: ['Y1', 'Y2'],
      capacity: {
        Y1: {
          classrooms: 2, studentsPerClassroom: 20, teachers: 2,
          teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
          maxStudents: null, occupancyPctByYear: [10],
        },
        Y2: {
          classrooms: 2, studentsPerClassroom: 20, teachers: 2,
          teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
          maxStudents: null, occupancyPctByYear: [90],
        },
      },
      fees: {
        categories: makeProject().fees.categories,
        amounts: { Y1: { tuition: 100000 }, Y2: { tuition: 100000 } },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        schoolOccupancyPctByYear: [50, 75, 100],
      },
    })
    const enrolment = computeEnrolment(project)
    expect(enrolment.map((y) => y.map((g) => g.students))).toEqual([
      [20, 20], [30, 30], [40, 40],
    ])
  })

  it('caps a year group at an explicit student number', () => {
    const project = makeProject({
      capacity: {
        Y1: {
          classrooms: 2, studentsPerClassroom: 20, teachers: 2,
          teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
          maxStudents: 30, occupancyPctByYear: [100],
        },
      },
    })
    expect(computeForecast(project).years[0]!.students).toBe(30)
  })

  it('falls back to the per group ramp when no school ramp is set', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
      capacity: {
        Y1: {
          classrooms: 2, studentsPerClassroom: 20, teachers: 2,
          teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
          maxStudents: null, occupancyPctByYear: [25, 50, 100],
        },
      },
    })
    expect(computeEnrolment(project).map((y) => y[0]!.students)).toEqual([10, 20, 40])
  })
})

describe('school plan', () => {
  const planProject = (overrides: Record<string, unknown> = {}) =>
    makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
      yearGroups: ['Y1', 'Y2', 'Y3', 'Y4'],
      capacity: Object.fromEntries(
        ['Y1', 'Y2', 'Y3', 'Y4'].map((g) => [
          g,
          {
            classrooms: 2, studentsPerClassroom: 25, teachers: 2,
            teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
            maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100],
          },
        ]),
      ),
      fees: {
        categories: makeProject().fees.categories,
        amounts: Object.fromEntries(
          ['Y1', 'Y2', 'Y3', 'Y4'].map((g) => [g, { tuition: 100000 }]),
        ),
      },
      ...overrides,
    })

  it('spreads the school total evenly when the taper is zero', () => {
    const project = planProject({
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        schoolPlan: {
          enabled: true, maxSchoolStudents: null,
          totalStudentsByYear: [100, 160, 200], taperPct: 0,
        },
      },
    })
    const rows = computeEnrolment(project)
    expect(rows[0]!.map((e) => e.students)).toEqual([25, 25, 25, 25])
    expect(rows[2]!.map((e) => e.students)).toEqual([50, 50, 50, 50])
  })

  it('weights the early years when the taper is set', () => {
    const project = planProject({
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        schoolPlan: {
          enabled: true, maxSchoolStudents: null,
          totalStudentsByYear: [100], taperPct: 60,
        },
      },
    })
    const first = computeEnrolment(project)[0]!.map((e) => e.students)
    // Weights taper 1.0, 0.8, 0.6, 0.4 and sum to 2.8.
    expect(first[0]).toBeCloseTo(100 / 2.8, 6)
    expect(first[3]).toBeCloseTo((100 * 0.4) / 2.8, 6)
    expect(first.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6)
  })

  it('passes overflow from a full year group to the others', () => {
    const project = planProject({
      capacity: {
        Y1: { classrooms: 1, studentsPerClassroom: 10, teachers: 1, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100] },
        Y2: { classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100] },
        Y3: { classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100] },
        Y4: { classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100] },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        schoolPlan: {
          enabled: true, maxSchoolStudents: null,
          totalStudentsByYear: [120], taperPct: 0,
        },
      },
    })
    const first = computeEnrolment(project)[0]!.map((e) => e.students)
    expect(first[0]).toBe(10)
    expect(first.reduce((a, b) => a + b, 0)).toBeCloseTo(120, 6)
  })

  it('holds unopened year groups at zero until their opening year', () => {
    const project = planProject({
      capacity: {
        Y1: { classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100] },
        Y2: { classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100] },
        Y3: { classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 2, occupancyPctByYear: [100] },
        Y4: { classrooms: 2, studentsPerClassroom: 25, teachers: 2, teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100, maxStudents: null, openFromYearIndex: 2, occupancyPctByYear: [100] },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        schoolPlan: {
          enabled: true, maxSchoolStudents: null,
          totalStudentsByYear: [80, 80, 160], taperPct: 0,
        },
      },
    })
    const rows = computeEnrolment(project)
    expect(rows[0]!.map((e) => e.students)).toEqual([40, 40, 0, 0])
    expect(rows[2]!.map((e) => e.students)).toEqual([40, 40, 40, 40])
  })

  it('never exceeds the maximum school size', () => {
    const project = planProject({
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        schoolPlan: {
          enabled: true, maxSchoolStudents: 150,
          totalStudentsByYear: [100, 400, 400], taperPct: 0,
        },
      },
    })
    const totals = computeEnrolment(project).map((r) =>
      r.reduce((a, b) => a + b.students, 0),
    )
    expect(totals).toEqual([100, 150, 150])
  })
})

describe('discounts', () => {
  it('stacks sibling and scholarship discounts against discountable revenue only', () => {
    const project = makeProject({
      fees: {
        categories: [
          ...makeProject().fees.categories,
          {
            id: 'bus',
            name: 'Bus',
            mandatory: false,
            uptakePct: 50,
            includedInStm: false,
            discountable: false,
            taxTreatment: 'exempt',
            billingFrequency: 'annual',
            chargeBasis: 'perStudent',
            escalationGroup: 'other',
          },
        ],
        amounts: { Y1: { tuition: 100000, bus: 10000 } },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        discounts: {
          siblingPct: 10,
          siblingEligiblePct: 20,
          staffChildPct: 0,
          staffChildPlaces: 0,
          scholarshipPct: 100,
          scholarshipPlaces: 4,
          earlyPaymentPct: 0,
          earlyPaymentTakeUpPct: 0,
        },
      },
    })
    const year = computeForecast(project).years[0]!
    // Bus: 40 students x 50% uptake x 10,000 = 200,000, not discountable.
    expect(year.grossRevenue).toBe(4_200_000)
    // Discount rate = (0.10 x 0.20) + (1.00 x 4/40) = 0.12 on tuition only.
    expect(year.discounts).toBeCloseTo(4_000_000 * 0.12, 6)
  })
})

describe('retention and gross entrants', () => {
  it('bills registration on replacements, not only on net growth', () => {
    const project = makeProject({
      calendar: { academicYearStart: 2027, financialYearStartMonth: 9, forecastYears: 3, termsPerYear: 3 },
      capacity: {
        Y1: {
          classrooms: 4, studentsPerClassroom: 25, teachers: 4,
          teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
          maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100],
        },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        retentionPct: { Y1: 90 },
      },
    })
    const rows = computeEnrolment(project)
    // 100 students held flat. Ten per cent leave, so ten must be replaced.
    expect(rows[1]![0]!.students).toBe(100)
    expect(rows[1]![0]!.leavers).toBeCloseTo(10, 6)
    expect(rows[1]![0]!.newEntrants).toBeCloseTo(10, 6)
  })
})

describe('tax', () => {
  it('separates inclusive from exclusive treatment on the same fee', () => {
    const inclusive = makeProject({
      fees: {
        categories: [
          { ...makeProject().fees.categories[0]!, taxTreatment: 'inclusive' },
        ],
        amounts: { Y1: { tuition: 100000 } },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        taxRatePct: 14,
      },
    })
    const exclusive = makeProject({
      fees: {
        categories: [
          { ...makeProject().fees.categories[0]!, taxTreatment: 'exclusive' },
        ],
        amounts: { Y1: { tuition: 100000 } },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        taxRatePct: 14,
      },
    })
    expect(computeForecast(inclusive).years[0]!.grossRevenue).toBeCloseTo(
      4_000_000 / 1.14,
      6,
    )
    expect(computeForecast(inclusive).years[0]!.taxCollected).toBeCloseTo(
      4_000_000 - 4_000_000 / 1.14,
      6,
    )
    expect(computeForecast(exclusive).years[0]!.grossRevenue).toBe(4_000_000)
    expect(computeForecast(exclusive).years[0]!.taxCollected).toBeCloseTo(560_000, 6)
  })
})

describe('discount allocation', () => {
  it('gives each student one discount rather than blending rates', () => {
    const project = makeProject({
      capacity: {
        Y1: {
          classrooms: 4, studentsPerClassroom: 25, teachers: 4,
          teachingAssistants: 0, coTeachers: 0, maxCapacityPct: 100,
          maxStudents: null, openFromYearIndex: 0, occupancyPctByYear: [100],
        },
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        discounts: {
          siblingPct: 10, siblingEligiblePct: 100,
          staffChildPct: 50, staffChildPlaces: 10,
          scholarshipPct: 100, scholarshipPlaces: 5,
          earlyPaymentPct: 0, earlyPaymentTakeUpPct: 0,
        },
      },
    })
    // 5 free, 10 at half, the remaining 85 at ten per cent, over 100 students.
    const expected = (5 * 1 + 10 * 0.5 + 85 * 0.1) / 100
    expect(discountRate(project, 100)).toBeCloseTo(expected, 6)
  })
})

describe('stm', () => {
  const tiered = makeProject({
    stm: {
      counterpartyName: 'Operating Partner',
      basis: 'netRevenue',
      ratePct: 0,
      tiers: [
        { thresholdFrom: 0, ratePct: 10 },
        { thresholdFrom: 3_000_000, ratePct: 5 },
      ],
      minimumGuarantee: null,
      paymentFrequency: 'annual',
      startYearIndex: 0,
      endYearIndex: null,
    },
  })

  it('applies marginal tiers across a threshold', () => {
    const year = computeForecast(tiered).years[0]!
    // 3,000,000 at 10% plus 1,000,000 at 5% = 350,000.
    expect(year.stmLiability).toBeCloseTo(350_000, 6)
  })

  it('binds the minimum guarantee in a low revenue year', () => {
    const project = makeProject({
      stm: {
        counterpartyName: 'Operating Partner',
        basis: 'netRevenue',
        ratePct: 5,
        tiers: [],
        minimumGuarantee: 500_000,
        paymentFrequency: 'annual',
        startYearIndex: 0,
        endYearIndex: null,
      },
    })
    expect(stmLiability(project, 1_000_000, 0)).toBe(500_000)
    expect(stmLiability(project, 20_000_000, 0)).toBe(1_000_000)
  })

  it('pays nothing outside the agreement window', () => {
    expect(
      stmLiability(
        makeProject({
          stm: {
            counterpartyName: 'Operating Partner',
            basis: 'netRevenue',
            ratePct: 10,
            tiers: [],
            minimumGuarantee: 400_000,
            paymentFrequency: 'annual',
            startYearIndex: 2,
            endYearIndex: 5,
          },
        }),
        4_000_000,
        0,
      ),
    ).toBe(0)
  })
})

describe('collections', () => {
  it('defers the final term and applies bad debt', () => {
    const project = makeProject({
      calendar: {
        academicYearStart: 2027,
        financialYearStartMonth: 9,
        forecastYears: 3,
        termsPerYear: 3,
      },
      revenueAssumptions: {
        ...makeProject().revenueAssumptions,
        collections: {
          termSplit: [50, 30, 20],
          payInFullPct: 0,
          badDebtPct: 5,
          dsoDays: 365,
        },
      },
    })
    const years = computeForecast(project).years
    const cashDue = 4_000_000 * 0.95
    expect(years[0]!.collectedCash).toBeCloseTo(cashDue * 0.8, 6)
    expect(years[1]!.collectedCash).toBeCloseTo(cashDue * 0.8 + cashDue * 0.2, 6)
  })
})
