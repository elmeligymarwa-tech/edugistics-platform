import { orderedYearGroups, ProjectSchema, type Project } from '@/domain/schema'
import { CostModelSchema, type CostModel } from '@/domain/costs'
import { computeCostForecast, type CostForecast } from '@/engine/costs'
import { interpolateFeeLadder } from '@/lib/egp-fee-bands'
import type { ConsultantPatch } from './route-contract'

const DEFAULT_STUDENTS_PER_CLASSROOM = 25

/**
 * Builds an in-memory candidate Project + CostModel from the base project
 * plus a proposed patch, purely to check break-even feasibility server-side
 * before the model's figures are shown as a proposal. Never touches the
 * store and never duplicates engine math — only assembles inputs for the
 * existing computeCostForecast. Capacity is a coarse even split across
 * selected year groups (25 students/classroom, a linear occupancy ramp) —
 * a feasibility check, not a substitute for the detailed Step 3 grid.
 */
export function buildCandidateForecast(base: Project, baseCostModel: CostModel, patch: ConsultantPatch): CostForecast {
  const yearGroups = patch.yearGroups ?? base.yearGroups
  const forecastYears = patch.calendar?.forecastYears ?? base.calendar.forecastYears

  const schoolPlan = patch.schoolPlan
    ? { ...base.revenueAssumptions.schoolPlan, ...patch.schoolPlan }
    : base.revenueAssumptions.schoolPlan

  const targetCapacity =
    schoolPlan.maxSchoolStudents ?? schoolPlan.totalStudentsByYear[schoolPlan.totalStudentsByYear.length - 1] ?? null

  let capacity = base.capacity
  if (targetCapacity && yearGroups.length > 0) {
    const perGroup = Math.ceil(targetCapacity / yearGroups.length)
    const classroomsPerGroup = Math.max(1, Math.ceil(perGroup / DEFAULT_STUDENTS_PER_CLASSROOM))
    const nextCapacity = { ...capacity }
    for (const group of yearGroups) {
      const existing = nextCapacity[group]
      nextCapacity[group] = {
        classrooms: classroomsPerGroup,
        studentsPerClassroom: DEFAULT_STUDENTS_PER_CLASSROOM,
        teachers: existing?.teachers ?? Math.max(1, Math.round(classroomsPerGroup)),
        teachingAssistants: existing?.teachingAssistants ?? 0,
        coTeachers: existing?.coTeachers ?? 0,
        maxCapacityPct: existing?.maxCapacityPct ?? 100,
        maxStudents: existing?.maxStudents ?? null,
        openFromYearIndex: existing?.openFromYearIndex ?? 0,
        occupancyPctByYear: Array.from({ length: forecastYears }, (_, index) => Math.min(100, 60 + index * 8)),
      }
    }
    capacity = nextCapacity
  }

  let fees = base.fees
  if (patch.feeCategories || patch.feePositioning) {
    const newCategories = (patch.feeCategories ?? []).map((category) => ({ ...category, id: `candidate-${category.id}` }))
    const categories = [...base.fees.categories, ...newCategories]
    const amounts: Record<string, Record<string, number>> = { ...base.fees.amounts }
    if (patch.feePositioning) {
      const ordered = orderedYearGroups({ ...base, yearGroups })
      const ladder = interpolateFeeLadder(patch.feePositioning, ordered)
      const tuitionCategory = categories.find((category) => category.escalationGroup === 'tuition')
      if (tuitionCategory) {
        for (const group of ordered) {
          amounts[group] = { ...amounts[group], [tuitionCategory.id]: ladder[group] }
        }
      }
    }
    fees = { categories, amounts }
  }

  const staffing = patch.staffPositions
    ? {
        positions: [
          ...base.staffing.positions,
          ...patch.staffPositions.map((position) => ({ ...position, id: `candidate-${position.id}` })),
        ],
      }
    : base.staffing

  const candidateProject = ProjectSchema.parse({
    ...base,
    yearGroups,
    calendar: { ...base.calendar, ...patch.calendar, forecastYears },
    capacity,
    fees,
    revenueAssumptions: { ...base.revenueAssumptions, schoolPlan },
    staffing,
  })

  const candidateCostModel = CostModelSchema.parse({
    ...baseCostModel,
    opex: patch.opexCategories
      ? [...baseCostModel.opex, ...patch.opexCategories.map((category) => ({ ...category, id: `candidate-${category.id}` }))]
      : baseCostModel.opex,
  })

  return computeCostForecast(candidateProject, candidateCostModel)
}
