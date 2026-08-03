import {
  orderedYearGroups,
  type Project,
  type FeeCategory,
  type YearGroupId,
} from '../domain/schema'

/**
 * Pure forecast engine. No React, no I/O, no rounding until presentation.
 */

export interface YearGroupEnrolment {
  yearGroup: YearGroupId
  students: number
  newEntrants: number
  capacityCeiling: number
}

export interface YearForecast {
  yearIndex: number
  label: string
  students: number
  grossRevenue: number
  discounts: number
  netRevenue: number
  taxCollected: number
  collectedCash: number
  stmLiability: number
  revenuePerStudent: number
  byCategory: Record<string, number>
  byYearGroup: Record<string, number>
  enrolment: YearGroupEnrolment[]
}

export interface Forecast {
  years: YearForecast[]
  totals: {
    grossRevenue: number
    netRevenue: number
    collectedCash: number
    stmLiability: number
  }
  cagrPct: number
}

/* ------------------------------------------------------------- utilities */

function rateForYear(rate: number | number[], yearIndex: number): number {
  if (Array.isArray(rate)) {
    if (rate.length === 0) return 0
    return rate[Math.min(yearIndex, rate.length - 1)] ?? 0
  }
  return rate
}

function occupancyForYear(occ: number[], yearIndex: number): number {
  if (occ.length === 0) return 0
  return occ[Math.min(yearIndex, occ.length - 1)] ?? 0
}

function escalationFactor(
  project: Project,
  category: FeeCategory,
  yearIndex: number,
): number {
  const a = project.revenueAssumptions
  const source =
    category.escalationGroup === 'tuition'
      ? a.tuitionEscalationPct
      : a.otherFeeEscalationPct
  let factor = 1
  for (let y = 1; y <= yearIndex; y += 1) {
    factor *= 1 + rateForYear(source, y) / 100
  }
  return factor
}

function capacityCeiling(project: Project, group: YearGroupId): number {
  const c = project.capacity[group]
  if (!c) return 0
  return (c.classrooms * c.studentsPerClassroom * c.maxCapacityPct) / 100
}

/* ------------------------------------------------------------- enrolment */

export function computeEnrolment(project: Project): YearGroupEnrolment[][] {
  const groups = orderedYearGroups(project)
  const years = project.calendar.forecastYears
  const a = project.revenueAssumptions
  const result: YearGroupEnrolment[][] = []

  for (let y = 0; y < years; y += 1) {
    const row: YearGroupEnrolment[] = []
    for (let g = 0; g < groups.length; g += 1) {
      const group = groups[g] as YearGroupId
      const ceiling = capacityCeiling(project, group)
      const capacity = project.capacity[group]
      const intake = a.newIntake[group]?.[y] ?? 0

      let students: number
      let newEntrants: number

      if (a.enrolmentModel === 'occupancy' || y === 0) {
        const occ = capacity ? occupancyForYear(capacity.occupancyPctByYear, y) : 0
        students = Math.min(ceiling, (ceiling * occ) / 100)
        const prior = y === 0 ? 0 : (result[y - 1]?.[g]?.students ?? 0)
        newEntrants = Math.max(0, students - prior)
      } else {
        const priorGroupPrevYear =
          a.progression && g > 0 ? (result[y - 1]?.[g - 1]?.students ?? 0) : 0
        const sameGroupPrevYear = result[y - 1]?.[g]?.students ?? 0
        const retention = (a.retentionPct[group] ?? 100) / 100
        const carried = a.progression
          ? priorGroupPrevYear * retention
          : sameGroupPrevYear * retention
        students = Math.min(ceiling, carried + intake)
        newEntrants = Math.max(0, students - carried)
      }

      row.push({ yearGroup: group, students, newEntrants, capacityCeiling: ceiling })
    }
    result.push(row)
  }

  return result
}

/* --------------------------------------------------------------- revenue */

interface RevenueSlice {
  gross: number
  discountableGross: number
  stmGross: number
  tax: number
  byCategory: Record<string, number>
  byYearGroup: Record<string, number>
}

function payingUnits(
  category: FeeCategory,
  enrolment: YearGroupEnrolment,
  avgSiblings: number,
): number {
  switch (category.chargeBasis) {
    case 'perFamily':
      return enrolment.students / Math.max(1, avgSiblings)
    case 'oneOffOnEntry':
      return enrolment.newEntrants
    default:
      return enrolment.students
  }
}

function netOfTax(amount: number, category: FeeCategory, taxRatePct: number) {
  if (category.taxTreatment === 'inclusive') {
    const net = amount / (1 + taxRatePct / 100)
    return { revenue: net, tax: amount - net }
  }
  if (category.taxTreatment === 'exclusive') {
    return { revenue: amount, tax: (amount * taxRatePct) / 100 }
  }
  return { revenue: amount, tax: 0 }
}

function revenueForYear(
  project: Project,
  enrolment: YearGroupEnrolment[],
  yearIndex: number,
): RevenueSlice {
  const a = project.revenueAssumptions
  const slice: RevenueSlice = {
    gross: 0,
    discountableGross: 0,
    stmGross: 0,
    tax: 0,
    byCategory: {},
    byYearGroup: {},
  }

  for (const entry of enrolment) {
    const amounts = project.fees.amounts[entry.yearGroup] ?? {}
    for (const category of project.fees.categories) {
      const base = amounts[category.id] ?? 0
      if (base === 0) continue

      const fee = base * escalationFactor(project, category, yearIndex)
      const uptake = category.mandatory ? 100 : category.uptakePct
      const charged =
        fee * payingUnits(category, entry, a.avgSiblingsPerFamily) * (uptake / 100)
      if (charged === 0) continue

      const { revenue, tax } = netOfTax(charged, category, a.taxRatePct)

      slice.gross += revenue
      slice.tax += tax
      if (category.discountable) slice.discountableGross += revenue
      if (category.includedInStm) slice.stmGross += revenue
      slice.byCategory[category.id] = (slice.byCategory[category.id] ?? 0) + revenue
      slice.byYearGroup[entry.yearGroup] =
        (slice.byYearGroup[entry.yearGroup] ?? 0) + revenue
    }
  }

  return slice
}

/* ------------------------------------------------------------- discounts */

export function discountRate(project: Project, totalStudents: number): number {
  const d = project.revenueAssumptions.discounts
  if (totalStudents <= 0) return 0

  const sibling = (d.siblingPct / 100) * (d.siblingEligiblePct / 100)
  const staff = (d.staffChildPct / 100) * (Math.min(d.staffChildPlaces, totalStudents) / totalStudents)
  const scholarship =
    (d.scholarshipPct / 100) * (Math.min(d.scholarshipPlaces, totalStudents) / totalStudents)
  const early = (d.earlyPaymentPct / 100) * (d.earlyPaymentTakeUpPct / 100)

  return Math.min(1, sibling + staff + scholarship + early)
}

/* ------------------------------------------------------------------- stm */

export function stmLiability(project: Project, base: number, yearIndex: number): number {
  const stm = project.stm
  if (!stm) return 0
  if (yearIndex < stm.startYearIndex) return 0
  if (stm.endYearIndex !== null && yearIndex > stm.endYearIndex) return 0

  let liability: number
  if (stm.tiers.length > 0) {
    const tiers = [...stm.tiers].sort((x, y) => x.thresholdFrom - y.thresholdFrom)
    liability = 0
    for (let i = 0; i < tiers.length; i += 1) {
      const from = tiers[i]!.thresholdFrom
      const to = tiers[i + 1]?.thresholdFrom ?? Infinity
      if (base <= from) break
      const bandAmount = Math.min(base, to) - from
      liability += (bandAmount * tiers[i]!.ratePct) / 100
    }
  } else {
    liability = (base * stm.ratePct) / 100
  }

  if (stm.minimumGuarantee !== null) {
    liability = Math.max(liability, stm.minimumGuarantee)
  }
  return liability
}

/* ----------------------------------------------------------- collections */

function deferralFraction(project: Project): number {
  const c = project.revenueAssumptions.collections
  const lastTermShare = (c.termSplit[c.termSplit.length - 1] ?? 0) / 100
  const dso = Math.min(c.dsoDays, 365) / 365
  return lastTermShare * dso * (1 - c.payInFullPct / 100)
}

/* ---------------------------------------------------------------- master */

export function computeForecast(project: Project): Forecast {
  const enrolment = computeEnrolment(project)
  const years: YearForecast[] = []
  const deferRate = deferralFraction(project)
  const badDebt = project.revenueAssumptions.collections.badDebtPct / 100
  let carriedCash = 0

  for (let y = 0; y < enrolment.length; y += 1) {
    const row = enrolment[y] as YearGroupEnrolment[]
    const slice = revenueForYear(project, row, y)
    const students = row.reduce((sum, e) => sum + e.students, 0)

    const discounts = slice.discountableGross * discountRate(project, students)
    const netRevenue = slice.gross - discounts

    const cashDue = netRevenue * (1 - badDebt)
    const deferred = cashDue * deferRate
    const collectedCash = cashDue - deferred + carriedCash
    carriedCash = deferred

    const discountShare = slice.gross > 0 ? 1 - discounts / slice.gross : 1
    const stmBase =
      project.stm?.basis === 'grossRevenue'
        ? slice.stmGross
        : project.stm?.basis === 'collectedCash'
          ? slice.stmGross * discountShare * (1 - badDebt)
          : slice.stmGross * discountShare

    years.push({
      yearIndex: y,
      label: `${project.calendar.academicYearStart + y}/${project.calendar.academicYearStart + y + 1}`,
      students,
      grossRevenue: slice.gross,
      discounts,
      netRevenue,
      taxCollected: slice.tax,
      collectedCash,
      stmLiability: stmLiability(project, stmBase, y),
      revenuePerStudent: students > 0 ? netRevenue / students : 0,
      byCategory: slice.byCategory,
      byYearGroup: slice.byYearGroup,
      enrolment: row,
    })
  }

  const first = years[0]?.netRevenue ?? 0
  const last = years[years.length - 1]?.netRevenue ?? 0
  const span = years.length - 1
  const cagrPct =
    span > 0 && first > 0 ? ((last / first) ** (1 / span) - 1) * 100 : 0

  return {
    years,
    totals: {
      grossRevenue: years.reduce((s, y) => s + y.grossRevenue, 0),
      netRevenue: years.reduce((s, y) => s + y.netRevenue, 0),
      collectedCash: years.reduce((s, y) => s + y.collectedCash, 0),
      stmLiability: years.reduce((s, y) => s + y.stmLiability, 0),
    },
    cagrPct,
  }
}
