import { orderedYearGroups, type Project } from '../domain/schema'
import type { CostModel, OpexCategory } from '../domain/costs'
import {
  computeForecast,
  computeEnrolment,
  type Forecast,
  type YearGroupEnrolment,
} from './revenue'

/**
 * Version 2 cost engine. Pure functions, no React, no I/O.
 * Revenue comes from computeForecast. Nothing here recalculates it.
 */

export interface PayrollLine {
  positionId: string
  title: string
  section: string
  headcount: number
  salaries: number
  allowances: number
  onCosts: number
  recruitment: number
  training: number
  total: number
  derived: boolean
}

export interface YearPayroll {
  yearIndex: number
  headcount: number
  salaries: number
  allowances: number
  onCosts: number
  recruitment: number
  training: number
  total: number
  lines: PayrollLine[]
}

export interface YearStatement {
  yearIndex: number
  label: string
  students: number
  netRevenue: number
  payroll: number
  opex: number
  stm: number
  ebitda: number
  depreciation: number
  ebit: number
  tax: number
  netProfit: number
  ebitdaMarginPct: number
  costPerStudent: number
  /* cash flow */
  cashCollected: number
  cashCostsPaid: number
  capexSpend: number
  taxPaid: number
  netCashMovement: number
  closingCash: number
  opexByGroup: Record<string, number>
}

export interface CostForecast {
  years: YearStatement[]
  payroll: YearPayroll[]
  breakEvenYearIndex: number | null
  cashLowPoint: number
  peakFundingRequirement: number
  totals: {
    netRevenue: number
    payroll: number
    opex: number
    netProfit: number
  }
}

/* ------------------------------------------------------------- utilities */

function rateForYear(rate: number | number[], yearIndex: number): number {
  if (Array.isArray(rate)) {
    if (rate.length === 0) return 0
    return rate[Math.min(yearIndex, rate.length - 1)] ?? 0
  }
  return rate
}

function compound(rate: number | number[], yearIndex: number): number {
  let factor = 1
  for (let y = 1; y <= yearIndex; y += 1) factor *= 1 + rateForYear(rate, y) / 100
  return factor
}

/**
 * Teaching headcount follows enrolment, not the full-capacity classroom count.
 * A school running at half occupancy opens half the classes and hires for those.
 * Pass a yearIndex and enrolment to scale; omit them for the full-capacity figure.
 */
export function derivedTeachingHeadcount(
  project: Project,
  studentsByGroup?: Record<string, number>,
) {
  let teachers = 0
  let teachingAssistants = 0
  let coTeachers = 0

  for (const group of orderedYearGroups(project)) {
    const c = project.capacity[group]
    if (!c) continue

    let share = 1
    if (studentsByGroup) {
      const students = studentsByGroup[group] ?? 0
      const classesOpen =
        c.studentsPerClassroom > 0 ? Math.ceil(students / c.studentsPerClassroom) : 0
      share = c.classrooms > 0 ? Math.min(1, classesOpen / c.classrooms) : 0
    }

    teachers += c.teachers * share
    teachingAssistants += c.teachingAssistants * share
    coTeachers += c.coTeachers * share
  }

  return { teachers, teachingAssistants, coTeachers }
}

export function totalClassrooms(project: Project): number {
  return orderedYearGroups(project).reduce(
    (sum, g) => sum + (project.capacity[g]?.classrooms ?? 0),
    0,
  )
}

/* --------------------------------------------------------------- payroll */

export function computePayroll(
  project: Project,
  cost: CostModel,
  enrolment?: YearGroupEnrolment[][],
): YearPayroll[] {
  const years = project.calendar.forecastYears
  const rows = enrolment ?? computeEnrolment(project)
  const result: YearPayroll[] = []

  for (let y = 0; y < years; y += 1) {
    const byGroup: Record<string, number> = {}
    for (const entry of rows[y] ?? []) byGroup[entry.yearGroup] = entry.students
    const derived = derivedTeachingHeadcount(project, byGroup)
    const lines: PayrollLine[] = []

    for (const position of project.staffing.positions) {
      const plan = cost.payroll.headcountByYear[position.id]
      const planned = plan ? (plan[Math.min(y, plan.length - 1)] ?? 0) : null
      const role = cost.payroll.derivedRoleMap[position.id]
      const isDerived = planned === null && Boolean(role) && !position.manualOverride
      const headcount =
        planned !== null ? planned : isDerived && role ? derived[role] : position.headcount
      if (headcount === 0) continue

      const increment =
        position.annualIncrementPct > 0
          ? position.annualIncrementPct
          : cost.payroll.defaultIncrementPct !== 0
            ? cost.payroll.defaultIncrementPct
            : cost.inflationPct
      const factor = compound(increment, y)
      const monthsFactor = position.monthsWorked / 12

      /* Salary is monthly, so annual cost is monthly times contract months. */
      const salaries =
        position.averageSalary * position.monthsWorked * headcount * factor
      const allowances =
        (position.housingAllowance + position.transportAllowance) * headcount * factor
      const onCostRate =
        (position.employerTaxPct +
          position.nationalInsurancePct +
          position.medicalInsurancePct +
          position.pensionPct) /
        100
      const onCosts = salaries * onCostRate

      const priorHeadcount = y === 0 ? 0 : (result[y - 1]?.lines.find((l) => l.positionId === position.id)?.headcount ?? 0)
      const growthHires = Math.max(0, headcount - priorHeadcount)
      const replacementHires = (headcount * cost.payroll.turnoverPct) / 100
      const hires = cost.payroll.chargeRecruitmentOnNewHiresOnly
        ? growthHires + replacementHires
        : headcount

      const recruitment = position.recruitmentCost * hires * factor
      const training = position.trainingCost * headcount * factor

      lines.push({
        positionId: position.id,
        title: position.title,
        section: position.section,
        headcount,
        salaries,
        allowances,
        onCosts,
        recruitment,
        training,
        total: salaries + allowances + onCosts + recruitment + training,
        derived: isDerived,
      })
    }

    result.push({
      yearIndex: y,
      headcount: lines.reduce((s, l) => s + l.headcount, 0),
      salaries: lines.reduce((s, l) => s + l.salaries, 0),
      allowances: lines.reduce((s, l) => s + l.allowances, 0),
      onCosts: lines.reduce((s, l) => s + l.onCosts, 0),
      recruitment: lines.reduce((s, l) => s + l.recruitment, 0),
      training: lines.reduce((s, l) => s + l.training, 0),
      total: lines.reduce((s, l) => s + l.total, 0),
      lines,
    })
  }

  return result
}

/* ------------------------------------------------------------------ opex */

function opexAmount(
  category: OpexCategory,
  yearIndex: number,
  drivers: { students: number; staff: number; classrooms: number; netRevenue: number },
  inflationPct: number,
): number {
  if (yearIndex < category.startYearIndex) return 0
  if (category.endYearIndex !== null && yearIndex > category.endYearIndex) return 0

  const rate = category.escalationPct === null ? inflationPct : category.escalationPct
  const escalated = category.amount * compound(rate, yearIndex)

  switch (category.basis) {
    case 'perStudent':
      return escalated * drivers.students
    case 'perStaff':
      return escalated * drivers.staff
    case 'perClassroom':
      return escalated * drivers.classrooms
    case 'pctOfRevenue':
      return (drivers.netRevenue * category.amount) / 100
    case 'stepped':
      return escalated * Math.ceil(drivers.students / category.stepSizeStudents)
    default:
      return escalated
  }
}

/* ---------------------------------------------------------- depreciation */

export function computeDepreciation(cost: CostModel, years: number): number[] {
  const schedule = new Array<number>(years).fill(0)
  for (const item of cost.capex) {
    const annual = item.amount / item.usefulLifeYears
    for (let y = item.yearIndex; y < Math.min(years, item.yearIndex + item.usefulLifeYears); y += 1) {
      schedule[y] = (schedule[y] ?? 0) + annual
    }
  }
  return schedule
}

export function capexByYear(cost: CostModel, years: number): number[] {
  const schedule = new Array<number>(years).fill(0)
  for (const item of cost.capex) {
    if (item.yearIndex < years) {
      schedule[item.yearIndex] = (schedule[item.yearIndex] ?? 0) + item.amount
    }
  }
  return schedule
}

/* ------------------------------------------------------------ statements */

export function computeCostForecast(
  project: Project,
  cost: CostModel,
  revenue?: Forecast,
): CostForecast {
  const forecast = revenue ?? computeForecast(project)
  const payroll = computePayroll(project, cost, computeEnrolment(project))
  const years = forecast.years.length
  const depreciation = computeDepreciation(cost, years)
  const capex = capexByYear(cost, years)
  const classrooms = totalClassrooms(project)

  const statements: YearStatement[] = []
  const payablesDeferral = Math.min(cost.financing.payablesDays, 365) / 365
  let carriedPayables = 0
  let lossesCarried = 0
  let cash = cost.financing.openingCash

  for (let y = 0; y < years; y += 1) {
    const year = forecast.years[y]!
    const pay = payroll[y]!

    const drivers = {
      students: year.students,
      staff: pay.headcount,
      classrooms,
      netRevenue: year.netRevenue,
    }

    const opexByGroup: Record<string, number> = {}
    let opexTotal = 0
    for (const category of cost.opex) {
      const amount = opexAmount(category, y, drivers, cost.inflationPct)
      if (amount === 0) continue
      opexByGroup[category.group] = (opexByGroup[category.group] ?? 0) + amount
      opexTotal += amount
    }

    const stm = year.stmLiability
    const ebitda = year.netRevenue - pay.total - opexTotal - stm
    const dep = depreciation[y] ?? 0
    const ebit = ebitda - dep

    let taxable = ebit
    if (cost.financing.carryLossesForward) {
      taxable = ebit - lossesCarried
      if (taxable < 0) {
        lossesCarried = -taxable
        taxable = 0
      } else {
        lossesCarried = 0
      }
    }
    const tax = Math.max(0, taxable) * (cost.financing.corporateTaxPct / 100)
    const netProfit = ebit - tax

    const cashCosts = pay.total + opexTotal + stm
    const deferred = cashCosts * payablesDeferral
    const cashCostsPaid = cashCosts - deferred + carriedPayables
    carriedPayables = deferred

    const capexSpend = capex[y] ?? 0
    const netCashMovement = year.collectedCash - cashCostsPaid - capexSpend - tax
    cash += netCashMovement

    statements.push({
      yearIndex: y,
      label: year.label,
      students: year.students,
      netRevenue: year.netRevenue,
      payroll: pay.total,
      opex: opexTotal,
      stm,
      ebitda,
      depreciation: dep,
      ebit,
      tax,
      netProfit,
      ebitdaMarginPct: year.netRevenue > 0 ? (ebitda / year.netRevenue) * 100 : 0,
      costPerStudent:
        year.students > 0 ? (pay.total + opexTotal + stm) / year.students : 0,
      cashCollected: year.collectedCash,
      cashCostsPaid,
      capexSpend,
      taxPaid: tax,
      netCashMovement,
      closingCash: cash,
      opexByGroup,
    })
  }

  const breakEven = statements.findIndex((s) => s.netProfit >= 0)
  const closingBalances = statements.map((s) => s.closingCash)
  const cashLowPoint = closingBalances.length > 0 ? Math.min(...closingBalances) : 0

  return {
    years: statements,
    payroll,
    breakEvenYearIndex: breakEven === -1 ? null : breakEven,
    cashLowPoint,
    peakFundingRequirement: cashLowPoint < 0 ? -cashLowPoint : 0,
    totals: {
      netRevenue: statements.reduce((s, y) => s + y.netRevenue, 0),
      payroll: statements.reduce((s, y) => s + y.payroll, 0),
      opex: statements.reduce((s, y) => s + y.opex, 0),
      netProfit: statements.reduce((s, y) => s + y.netProfit, 0),
    },
  }
}
