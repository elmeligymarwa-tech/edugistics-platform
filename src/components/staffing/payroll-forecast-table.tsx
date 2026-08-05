'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StaffSectionSchema, type Project } from '@/domain/schema'
import type { CostForecast, PayrollLine } from '@/engine/costs'
import { downloadCsv } from '@/lib/csv'
import { formatMoney, formatNumber } from '@/lib/format'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'

type DetailKey = 'salaries' | 'allowances' | 'onCosts' | 'recruitment' | 'training'

const DETAIL_ROWS: Array<{ key: DetailKey; label: string }> = [
  { key: 'salaries', label: 'Salaries' },
  { key: 'allowances', label: 'Allowances' },
  { key: 'onCosts', label: 'On-costs' },
  { key: 'recruitment', label: 'Recruitment' },
  { key: 'training', label: 'Training' },
]

function lineFor(lines: PayrollLine[], positionId: string): PayrollLine | undefined {
  return lines.find((line) => line.positionId === positionId)
}

export function PayrollForecastTable({
  project,
  costForecast,
}: {
  project: Project
  costForecast: CostForecast
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const years = costForecast.payroll

  const toggle = (positionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(positionId)) next.delete(positionId)
      else next.add(positionId)
      return next
    })
  }

  const handleExport = () => {
    const header = ['', ...years.map((year) => `Year ${year.yearIndex + 1}`)]
    const body: string[][] = []

    for (const section of StaffSectionSchema.options) {
      const positions = project.staffing.positions.filter((position) => position.section === section)
      if (positions.length === 0) continue
      body.push([STAFF_SECTION_LABELS[section] ?? section, ...years.map(() => '')])
      for (const position of positions) {
        body.push([
          position.title,
          ...years.map((year) => formatMoney(lineFor(year.lines, position.id)?.total ?? 0, project.meta)),
        ])
        for (const detail of DETAIL_ROWS) {
          body.push([
            `  ${detail.label}`,
            ...years.map((year) => formatMoney(lineFor(year.lines, position.id)?.[detail.key] ?? 0, project.meta)),
          ])
        }
      }
    }
    body.push(['Total payroll', ...years.map((year) => formatMoney(year.total, project.meta))])

    downloadCsv(`${project.meta.schoolName} - payroll forecast.csv`, [header, ...body])
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Payroll forecast</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">
                Position
              </th>
              {years.map((year) => (
                <th key={year.yearIndex} className="p-2 text-right font-medium text-muted-foreground">
                  Year {year.yearIndex + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {StaffSectionSchema.options.map((section) => {
              const positions = project.staffing.positions.filter(
                (position) => position.section === section,
              )
              if (positions.length === 0) return null
              return (
                <Fragment key={section}>
                  <tr className="border-t border-border">
                    <td
                      colSpan={years.length + 1}
                      className="sticky left-0 bg-card p-2 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      {STAFF_SECTION_LABELS[section] ?? section}
                    </td>
                  </tr>
                  {positions.map((position) => {
                    const isExpanded = expanded.has(position.id)
                    return (
                      <Fragment key={position.id}>
                        <tr className="border-t border-border">
                          <td className="sticky left-0 bg-card p-2 font-medium text-foreground">
                            <button
                              type="button"
                              className="flex items-center gap-1.5"
                              onClick={() => toggle(position.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-3.5 text-muted-foreground" />
                              )}
                              {position.title}
                            </button>
                          </td>
                          {years.map((year) => (
                            <td key={year.yearIndex} className="p-2 text-right tabular-nums text-foreground">
                              {formatMoney(lineFor(year.lines, position.id)?.total ?? 0, project.meta)}
                            </td>
                          ))}
                        </tr>
                        {isExpanded
                          ? DETAIL_ROWS.map((detail) => (
                              <tr key={`${position.id}-${detail.key}`} className="border-t border-border/50">
                                <td className="sticky left-0 bg-card py-1.5 pr-2 pl-8 text-muted-foreground">
                                  {detail.label}
                                </td>
                                {years.map((year) => (
                                  <td
                                    key={year.yearIndex}
                                    className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground"
                                  >
                                    {formatMoney(lineFor(year.lines, position.id)?.[detail.key] ?? 0, project.meta)}
                                  </td>
                                ))}
                              </tr>
                            ))
                          : null}
                        {isExpanded ? (
                          <tr key={`${position.id}-headcount`} className="border-t border-border/50">
                            <td className="sticky left-0 bg-card py-1.5 pr-2 pl-8 text-muted-foreground">
                              Headcount
                            </td>
                            {years.map((year) => (
                              <td
                                key={year.yearIndex}
                                className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground"
                              >
                                {formatNumber(lineFor(year.lines, position.id)?.headcount ?? 0, project.meta.locale)}
                              </td>
                            ))}
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
            <tr className="border-t border-border">
              <td className="sticky left-0 bg-card p-2 font-semibold text-foreground">Total payroll</td>
              {years.map((year) => (
                <td key={year.yearIndex} className="p-2 text-right font-semibold tabular-nums text-foreground">
                  {formatMoney(year.total, project.meta)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
