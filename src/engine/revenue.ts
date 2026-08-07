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
  /** Net growth over the prior forecast year; zero when the year group held flat or shrank. */
  newEntrants: number
  leavers: number
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
  if (c.maxStudents !== null) return c.maxStudents
  return (c.classrooms * c.studentsPerClassroom * c.maxCapacityPct) / 100
}

/** The school wide ramp wins where it is set. */
function rampFor(project: Project, group: YearGroupId): number[] {
  const school = project.revenueAssumptions.schoolOccupancyPctByYear
  if (school.length > 0) return school
  return project.capacity[group]?.occupancyPctByYear ?? []
}

/* --------------------------------------------------- top down allocation */

/** Weight per year group, tapering from the first to the last. */
export function taperWeights(count: number, taperPct: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [1]
  const taper = Math.min(100, Math.max(0, taperPct)) / 100
  return Array.from({ length: count }, (_, i) => 1 - taper * (i / (count - 1)))
}

/**
 * Distribute a school total across open year groups by weight, respecting each
 * group's ceiling. Anything a full group cannot take flows to the others.
 */
export function allocateByWeight(
  total: number,
  entries: { key: string; weight: number; ceiling: number }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) out[e.key] = 0

  let pool = entries.filter((e) => e.ceiling > 0 && e.weight > 0)
  let remaining = Math.max(0, total)

  for (let guard = 0; guard < 50 && pool.length > 0 && remaining > 0; guard += 1) {
    const totalWeight = pool.reduce((s, e) => s + e.weight, 0)
    if (totalWeight <= 0) break

    const capped: typeof pool = []
    for (const e of pool) {
      if ((remaining * e.weight) / totalWeight > e.ceiling) capped.push(e)
    }

    if (capped.length === 0) {
      for (const e of pool) out[e.key] = (remaining * e.weight) / totalWeight
      remaining = 0
      break
    }

    for (const e of capped) {
      out[e.key] = e.ceiling
      remaining -= e.ceiling
    }
    pool = pool.filter((e) => !capped.includes(e))
  }

  return out
}

/* ------------------------------------------------------------- enrolment */

export function computeEnrolment(project: Project): YearGroupEnrolment[][] {
  const groups = orderedYearGroups(project)
  const years = project.calendar.forecastYears
  const a = project.revenueAssumptions
  const result: YearGroupEnrolment[][] = []

  const plan = a.schoolPlan

  if (plan.enabled) {
    const weights = taperWeights(groups.length, plan.taperPct)

    for (let y = 0; y < years; y += 1) {
      const open = groups
        .map((group, i) => ({ group, i }))
        .filter(({ group }) => y >= (project.capacity[group]?.openFromYearIndex ?? 0))

      const target = plan.totalStudentsByYear.length
        ? (plan.totalStudentsByYear[
            Math.min(y, plan.totalStudentsByYear.length - 1)
          ] ?? 0)
        : 0
      const capped =
        plan.maxSchoolStudents === null ? target : Math.min(target, plan.maxSchoolStudents)

      const allocation = allocateByWeight(
        capped,
        open.map(({ group, i }) => ({
          key: group,
          weight: weights[i] ?? 0,
          ceiling: capacityCeiling(project, group),
        })),
      )

      const row: YearGroupEnrolment[] = groups.map((group, g) => {
        const students = allocation[group] ?? 0
        const prior = y === 0 ? 0 : (result[y - 1]?.[g]?.students ?? 0)
        return {
          yearGroup: group,
          students,
          newEntrants: Math.max(0, students - prior),
          leavers: Math.max(0, prior - students),
          capacityCeiling: capacityCeiling(project, group),
        }
      })
      result.push(row)
    }

    return result
  }

  /**
   * Year one always comes from capacity occupancy — the "current intake" set in Step 3.
   * Every later year compounds the school-wide intake growth rate onto the prior year's
   * students, capped at that year group's own ceiling, unless a per-cell override in
   * intakeOverrides pins that (year group, year) figure directly — an override is taken
   * as-is, uncapped, the same way an over-capacity entry in Step 3 is shown rather than
   * silently rewritten.
   */
  for (let y = 0; y < years; y += 1) {
    const row: YearGroupEnrolment[] = []
    for (let g = 0; g < groups.length; g += 1) {
      const group = groups[g] as YearGroupId
      const ceiling = capacityCeiling(project, group)
      const capacity = project.capacity[group]
      const prior = y === 0 ? 0 : (result[y - 1]?.[g]?.students ?? 0)

      let students: number
      if (y === 0) {
        const occ = capacity ? occupancyForYear(rampFor(project, group), 0) : 0
        students = Math.min(ceiling, (ceiling * occ) / 100)
      } else {
        const override = a.intakeOverrides[group]?.[y] ?? null
        const grown = prior * (1 + a.intakeGrowthRatePct / 100)
        students = override ?? Math.min(ceiling, grown)
      }

      row.push({
        yearGroup: group,
        students,
        newEntrants: Math.max(0, students - prior),
        leavers: Math.max(0, prior - students),
        capacityCeiling: ceiling,
      })
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

function payingUnits(category: FeeCategory, enrolment: YearGroupEnrolment): number {
  switch (category.chargeBasis) {
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
      const charged = fee * payingUnits(category, entry) * (uptake / 100)
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

/**
 * Discounts are counted per student, not blended across revenue. A child on a
 * scholarship does not also take a staff discount, so the two are allocated in
 * priority order against the student roll. Early payment is a settlement
 * discount and applies on top.
 */
export function discountRate(project: Project, totalStudents: number): number {
  const d = project.revenueAssumptions.discounts
  if (totalStudents <= 0) return 0

  let remaining = totalStudents
  const scholarship = Math.min(d.scholarshipPlaces, remaining)
  remaining -= scholarship
  const staff = Math.min(d.staffChildPlaces, remaining)

  const weighted = scholarship * (d.scholarshipPct / 100) + staff * (d.staffChildPct / 100)

  const early = (d.earlyPaymentPct / 100) * (d.earlyPaymentTakeUpPct / 100)

  return Math.min(1, weighted / totalStudents + early)
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
