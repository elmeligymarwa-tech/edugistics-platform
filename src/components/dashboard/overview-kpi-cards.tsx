import { StatTile } from '@/components/ui/stat-tile'
import { orderedYearGroups, type Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatNumber } from '@/lib/format'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'

export function OverviewKpiCards({ project, forecast }: { project: Project; forecast: Forecast }) {
  const groups = orderedYearGroups(project)
  const firstYear = forecast.years[0]
  const capacityByGroup = new Map(
    (firstYear?.enrolment ?? []).map((entry) => [entry.yearGroup, entry.capacityCeiling]),
  )

  const totalClassrooms = groups.reduce((sum, group) => sum + (project.capacity[group]?.classrooms ?? 0), 0)
  const totalTeachers = groups.reduce((sum, group) => sum + (project.capacity[group]?.teachers ?? 0), 0)
  const totalCapacity = groups.reduce((sum, group) => sum + (capacityByGroup.get(group) ?? 0), 0)
  const staffCategoryCount = new Set(project.staffing.positions.map((position) => position.section)).size

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="School name" value={project.meta.schoolName} />
      <StatTile label="Forecast years" value={formatNumber(project.calendar.forecastYears, project.meta.locale)} />
      <StatTile
        label="Selected year groups"
        value={formatNumber(groups.length, project.meta.locale)}
        hint={groups.length > 0 ? groups.map((group) => YEAR_GROUP_LABELS[group]).join(', ') : undefined}
      />
      <StatTile label="Total classrooms" value={formatNumber(totalClassrooms, project.meta.locale)} />
      <StatTile label="Total teachers" value={formatNumber(totalTeachers, project.meta.locale)} />
      <StatTile label="Total capacity" value={formatNumber(totalCapacity, project.meta.locale)} />
      <StatTile
        label="Configured fee categories"
        value={formatNumber(project.fees.categories.length, project.meta.locale)}
      />
      <StatTile label="Configured staff categories" value={formatNumber(staffCategoryCount, project.meta.locale)} />
      <StatTile
        label="Total estimated students"
        value={formatNumber(firstYear?.students ?? 0, project.meta.locale)}
        hint={firstYear ? firstYear.label : undefined}
      />
    </div>
  )
}
