'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CurrencyText } from '@/components/ui/currency-text'
import { Switch } from '@/components/ui/switch'
import { StaffSectionSchema, orderedYearGroups, type Project } from '@/domain/schema'
import { formatMoney, formatNumber, formatPercent, type FormattedCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STAFF_SECTION_LABELS, YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { useProjectCostForecast, useProjectForecast } from '@/store/project-store'

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'fees', label: 'Fee ladder' },
  { key: 'revenue', label: 'Revenue assumptions' },
  { key: 'staffing', label: 'Staffing' },
  { key: 'financials', label: 'Financial summary' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

/**
 * A clean, read-only, large-type summary of the whole setup, for projecting
 * in a client meeting. Driven by the same store data the wizard already
 * has — no separate data path. Plain HTML tables rather than DataGrid: this
 * view (and its print output) needs every row to flow onto the page, not a
 * virtualized viewport.
 */
export function PresentationView({ project }: { project: Project }) {
  const [hiddenSections, setHiddenSections] = useState<Set<SectionKey>>(new Set())
  const forecast = useProjectForecast(project.id)
  const costForecast = useProjectCostForecast(project.id)
  const groups = orderedYearGroups(project)

  const toggleSection = (key: SectionKey) =>
    setHiddenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const isVisible = (key: SectionKey) => !hiddenSections.has(key)

  if (!forecast || !costForecast) return null

  const finalYear = forecast.years[forecast.years.length - 1]
  const breakEvenLabel =
    costForecast.breakEvenYearIndex !== null
      ? (costForecast.years[costForecast.breakEvenYearIndex]?.label ?? 'Not within forecast')
      : 'Not within forecast'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-6 pb-20 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <label
              key={section.key}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground"
            >
              <Switch checked={isVisible(section.key)} onCheckedChange={() => toggleSection(section.key)} />
              {section.label}
            </label>
          ))}
        </div>
        <Button type="button" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Print / save as PDF
        </Button>
      </div>

      <div className="text-center">
        {project.meta.logoBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.meta.logoBase64} alt="" className="mx-auto mb-4 h-16 w-16 object-contain" />
        ) : null}
        <h1 className="font-heading text-4xl font-semibold text-heading">{project.meta.schoolName}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {project.meta.country} · {project.calendar.forecastYears}-year forecast · {groups.length} year groups
        </p>
      </div>

      {isVisible('overview') ? (
        <PresentationSection title="Overview">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PresentationStat label="Year one students" value={formatNumber(forecast.years[0]?.students ?? 0, project.meta.locale)} />
            <PresentationStat
              label={`Students, ${finalYear?.label ?? ''}`}
              value={formatNumber(finalYear?.students ?? 0, project.meta.locale)}
            />
            <PresentationStat
              label={`Net revenue, ${finalYear?.label ?? ''}`}
              value={formatMoney(finalYear?.netRevenue ?? 0, project.meta)}
            />
            <PresentationStat label="Break-even" value={breakEvenLabel} />
          </div>
        </PresentationSection>
      ) : null}

      {isVisible('capacity') && groups.length > 0 ? (
        <PresentationSection title="Capacity">
          <PresentationTable
            headers={['Year group', 'Classrooms', 'Students / classroom', 'Max students']}
            rows={groups.map((group) => {
              const capacity = project.capacity[group]
              return [
                YEAR_GROUP_LABELS[group],
                formatNumber(capacity?.classrooms ?? 0, project.meta.locale),
                formatNumber(capacity?.studentsPerClassroom ?? 0, project.meta.locale),
                capacity?.maxStudents != null ? formatNumber(capacity.maxStudents, project.meta.locale) : '—',
              ]
            })}
          />
        </PresentationSection>
      ) : null}

      {isVisible('fees') && groups.length > 0 && project.fees.categories.length > 0 ? (
        <PresentationSection title="Fee ladder">
          <PresentationTable
            headers={['Year group', ...project.fees.categories.map((category) => category.name)]}
            rows={groups.map((group) => [
              YEAR_GROUP_LABELS[group],
              ...project.fees.categories.map((category) => formatMoney(project.fees.amounts[group]?.[category.id] ?? 0, project.meta)),
            ])}
          />
        </PresentationSection>
      ) : null}

      {isVisible('revenue') ? (
        <PresentationSection title="Revenue assumptions">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PresentationStat
              label="Enrolment model"
              value={project.revenueAssumptions.enrolmentModel === 'occupancy' ? 'Occupancy-driven' : 'Cohort progression'}
            />
            <PresentationStat
              label="Tuition escalation"
              value={formatPercent(
                typeof project.revenueAssumptions.tuitionEscalationPct === 'number'
                  ? project.revenueAssumptions.tuitionEscalationPct
                  : 0,
              )}
            />
            <PresentationStat label="Sibling discount" value={formatPercent(project.revenueAssumptions.discounts.siblingPct)} />
            <PresentationStat label="Scholarship discount" value={formatPercent(project.revenueAssumptions.discounts.scholarshipPct)} />
          </div>
        </PresentationSection>
      ) : null}

      {isVisible('staffing') ? (
        <PresentationSection title="Staffing">
          <PresentationTable
            headers={['Section', 'Headcount']}
            rows={StaffSectionSchema.options
              .map((section) => [
                STAFF_SECTION_LABELS[section] ?? section,
                formatNumber(
                  project.staffing.positions
                    .filter((position) => position.section === section)
                    .reduce((sum, position) => sum + position.headcount, 0),
                  project.meta.locale,
                ),
              ])
              .filter((row) => row[1] !== '0')}
          />
        </PresentationSection>
      ) : null}

      {isVisible('financials') ? (
        <PresentationSection title="Financial summary">
          <PresentationTable
            headers={['Year', 'Net revenue', 'EBITDA', 'Net profit', 'Closing cash']}
            rows={costForecast.years.map((year) => [
              year.label,
              formatMoney(year.netRevenue, project.meta),
              formatMoney(year.ebitda, project.meta),
              formatMoney(year.netProfit, project.meta),
              formatMoney(year.closingCash, project.meta),
            ])}
          />
        </PresentationSection>
      ) : null}
    </div>
  )
}

function PresentationSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-3 text-2xl font-semibold text-heading">{title}</h2>
      {children}
    </section>
  )
}

function PresentationStat({ label, value }: { label: string; value: string | FormattedCurrency }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {typeof value === 'object' ? <CurrencyText value={value} /> : <span className="text-foreground">{value}</span>}
      </p>
    </div>
  )
}

function PresentationTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | FormattedCurrency>> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-max border-collapse text-base">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((header, index) => (
              <th key={index} className={cn('p-3 font-semibold text-heading', index === 0 ? 'text-left' : 'text-right')}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/60 last:border-0 even:bg-muted/20">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={cn('p-3 tabular-nums', cellIndex > 0 && 'text-right')}>
                  {typeof cell === 'object' ? <CurrencyText value={cell} /> : <span className="text-foreground">{cell}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
