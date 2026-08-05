import { Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailItem } from '@/components/ui/detail-item'
import { StatTile } from '@/components/ui/stat-tile'
import { EmptyState } from '@/components/module-shell/empty-state'
import {
  StaffSectionSchema,
  orderedYearGroups,
  type Project,
  type ProjectMeta,
  type StaffPosition,
} from '@/domain/schema'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'

const MONEY_FIELDS: Array<{ key: keyof StaffPosition; label: string }> = [
  { key: 'averageSalary', label: 'Average salary' },
  { key: 'minimumSalary', label: 'Minimum salary' },
  { key: 'maximumSalary', label: 'Maximum salary' },
  { key: 'housingAllowance', label: 'Housing allowance' },
  { key: 'transportAllowance', label: 'Transport allowance' },
  { key: 'recruitmentCost', label: 'Recruitment cost' },
  { key: 'trainingCost', label: 'Training cost' },
]

const PERCENT_FIELDS: Array<{ key: keyof StaffPosition; label: string }> = [
  { key: 'annualIncrementPct', label: 'Annual increment' },
  { key: 'employerTaxPct', label: 'Employer tax' },
  { key: 'nationalInsurancePct', label: 'National insurance' },
  { key: 'medicalInsurancePct', label: 'Medical insurance' },
  { key: 'pensionPct', label: 'Pension' },
]

export function StaffingOverview({ project }: { project: Project }) {
  const groups = orderedYearGroups(project)
  const teacherCount = groups.reduce((sum, group) => sum + (project.capacity[group]?.teachers ?? 0), 0)
  const taCount = groups.reduce(
    (sum, group) => sum + (project.capacity[group]?.teachingAssistants ?? 0),
    0,
  )
  const coTeacherCount = groups.reduce((sum, group) => sum + (project.capacity[group]?.coTeachers ?? 0), 0)
  const totalTeaching = teacherCount + taCount + coTeacherCount

  const positions = project.staffing.positions

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Teachers" value={formatNumber(teacherCount, project.meta.locale)} />
        <StatTile label="Teaching assistants" value={formatNumber(taCount, project.meta.locale)} />
        <StatTile label="Co-teachers" value={formatNumber(coTeacherCount, project.meta.locale)} />
        <StatTile
          label="Total teaching headcount"
          value={formatNumber(totalTeaching, project.meta.locale)}
          hint="Derived from capacity in setup"
        />
      </div>

      {positions.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staffing positions configured"
          description="Positions, headcount and compensation are captured in the Staffing step of setup. Complete that step to see your payroll composition here."
          action={{ label: 'Go to setup', href: '/setup?step=6' }}
        />
      ) : (
        StaffSectionSchema.options.map((section) => {
          const sectionPositions = positions.filter((position) => position.section === section)
          if (sectionPositions.length === 0) return null
          return (
            <Card key={section}>
              <CardHeader>
                <CardTitle>{STAFF_SECTION_LABELS[section] ?? section}</CardTitle>
              </CardHeader>
              <CardContent className="gap-3 pt-0">
                {sectionPositions.map((position) => (
                  <PositionSummary key={position.id} position={position} meta={project.meta} />
                ))}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

function PositionSummary({ position, meta }: { position: StaffPosition; meta: ProjectMeta }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-foreground">{position.title}</p>
        {position.derivedFromCapacity ? <Badge variant="brand">Derived from capacity</Badge> : null}
        {position.manualOverride ? <Badge variant="warning">Overridden</Badge> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <DetailItem label="Headcount" value={formatNumber(position.headcount, meta.locale)} />
        {MONEY_FIELDS.map((field) => (
          <DetailItem
            key={field.key}
            label={field.label}
            value={formatMoney(position[field.key] as number, meta)}
          />
        ))}
        {PERCENT_FIELDS.map((field) => (
          <DetailItem
            key={field.key}
            label={field.label}
            value={formatPercent(position[field.key] as number)}
          />
        ))}
      </div>
    </div>
  )
}
