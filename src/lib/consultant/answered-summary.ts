import { ProjectSchema } from '@/domain/schema'

/**
 * Turns a (possibly partial/invalid) project snapshot into a plain-text
 * digest of what's already answered, so the interview prompt can skip
 * re-asking. Uses a lenient partial parse — an incomplete snapshot from a
 * brand-new project must never throw here, it should just summarize less.
 */
export function buildAnsweredSummary(projectSnapshot: unknown): string {
  const parsed = ProjectSchema.partial().safeParse(projectSnapshot)
  if (!parsed.success) return ''

  const project = parsed.data
  const lines: string[] = []

  if (project.meta?.country) lines.push(`- Country: ${project.meta.country}`)
  if (project.meta?.currencyCode) lines.push(`- Currency: ${project.meta.currencyCode}`)
  if (project.calendar?.forecastYears) lines.push(`- Forecast horizon: ${project.calendar.forecastYears} years`)
  if (project.yearGroups && project.yearGroups.length > 0) {
    lines.push(`- Year groups selected: ${project.yearGroups.join(', ')}`)
  }

  const schoolPlan = project.revenueAssumptions?.schoolPlan
  if (schoolPlan?.enabled && schoolPlan.maxSchoolStudents) {
    lines.push(`- Target capacity: ${schoolPlan.maxSchoolStudents} students`)
  }
  if (schoolPlan?.totalStudentsByYear && schoolPlan.totalStudentsByYear.length > 0) {
    lines.push(`- Enrolment by year already entered: ${schoolPlan.totalStudentsByYear.join(', ')}`)
  }

  const tuitionCategory = project.fees?.categories?.find((category) => category.escalationGroup === 'tuition')
  if (tuitionCategory) lines.push(`- Tuition fee category already set up: ${tuitionCategory.name}`)

  if (project.staffing?.positions && project.staffing.positions.length > 0) {
    lines.push(`- Staff positions already entered: ${project.staffing.positions.length}`)
  }

  return lines.join('\n')
}
