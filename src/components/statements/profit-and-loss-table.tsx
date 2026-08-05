'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OpexGroupSchema } from '@/domain/costs'
import { StaffSectionSchema, type Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { downloadCsv } from '@/lib/csv'
import { OPEX_GROUP_LABELS } from '@/lib/expenses-data'
import { formatMoney, formatPercent } from '@/lib/format'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'

type RowKey = 'netRevenue' | 'payroll' | 'opex' | 'stm' | 'ebitda' | 'depreciation' | 'ebit' | 'tax' | 'netProfit'

const ROWS: Array<{ key: RowKey; label: string; emphasis?: boolean; expandable?: 'payroll' | 'opex' }> = [
  { key: 'netRevenue', label: 'Net revenue' },
  { key: 'payroll', label: 'Payroll', expandable: 'payroll' },
  { key: 'opex', label: 'Operating expenses', expandable: 'opex' },
  { key: 'stm', label: 'STM' },
  { key: 'ebitda', label: 'EBITDA', emphasis: true },
  { key: 'depreciation', label: 'Depreciation' },
  { key: 'ebit', label: 'EBIT', emphasis: true },
  { key: 'tax', label: 'Tax' },
  { key: 'netProfit', label: 'Net profit', emphasis: true },
]

export function ProfitAndLossTable({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const [expanded, setExpanded] = useState<Set<RowKey>>(new Set())
  const years = costForecast.years

  const toggle = (key: RowKey) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const payrollBySection = (yearIndex: number) => {
    const lines = costForecast.payroll[yearIndex]?.lines ?? []
    return StaffSectionSchema.options
      .map((section) => ({
        section,
        total: lines.filter((line) => line.section === section).reduce((sum, line) => sum + line.total, 0),
      }))
      .filter((entry) => entry.total !== 0)
  }

  const handleExport = () => {
    const header = ['', ...years.map((year) => year.label)]
    const body: string[][] = ROWS.map((row) => [
      row.label,
      ...years.map((year) => formatMoney(year[row.key], project.meta)),
    ])
    body.push(['EBITDA margin', ...years.map((year) => formatPercent(year.ebitdaMarginPct))])
    body.push([
      'Net margin',
      ...years.map((year) => formatPercent(year.netRevenue > 0 ? (year.netProfit / year.netRevenue) * 100 : 0)),
    ])
    downloadCsv(`${project.meta.schoolName} - profit and loss.csv`, [header, ...body])
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Profit and loss</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">Line</th>
              {years.map((year) => (
                <th key={year.yearIndex} className="p-2 text-right font-medium text-muted-foreground">
                  {year.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const isExpanded = expanded.has(row.key)
              return (
                <Fragment key={row.key}>
                  <tr className="border-t border-border">
                    <td
                      className={`sticky left-0 bg-card p-2 text-foreground ${row.emphasis ? 'font-semibold' : 'font-medium'}`}
                    >
                      {row.expandable ? (
                        <button type="button" className="flex items-center gap-1.5" onClick={() => toggle(row.key)}>
                          {isExpanded ? (
                            <ChevronDown className="size-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 text-muted-foreground" />
                          )}
                          {row.label}
                        </button>
                      ) : (
                        row.label
                      )}
                    </td>
                    {years.map((year) => (
                      <td
                        key={year.yearIndex}
                        className={`p-2 text-right tabular-nums text-foreground ${row.emphasis ? 'font-semibold' : ''}`}
                      >
                        {formatMoney(year[row.key], project.meta)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && row.expandable === 'payroll'
                    ? StaffSectionSchema.options.map((section) => (
                        <tr key={section} className="border-t border-border/50">
                          <td className="sticky left-0 bg-card py-1.5 pr-2 pl-8 text-muted-foreground">
                            {STAFF_SECTION_LABELS[section] ?? section}
                          </td>
                          {years.map((year) => (
                            <td key={year.yearIndex} className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                              {formatMoney(
                                payrollBySection(year.yearIndex).find((entry) => entry.section === section)?.total ?? 0,
                                project.meta,
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    : null}
                  {isExpanded && row.expandable === 'opex'
                    ? OpexGroupSchema.options.map((group) => (
                        <tr key={group} className="border-t border-border/50">
                          <td className="sticky left-0 bg-card py-1.5 pr-2 pl-8 text-muted-foreground">
                            {OPEX_GROUP_LABELS[group]}
                          </td>
                          {years.map((year) => (
                            <td key={year.yearIndex} className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                              {formatMoney(year.opexByGroup[group] ?? 0, project.meta)}
                            </td>
                          ))}
                        </tr>
                      ))
                    : null}
                </Fragment>
              )
            })}
            <tr className="border-t border-border">
              <td className="sticky left-0 bg-card p-2 text-foreground">EBITDA margin</td>
              {years.map((year) => (
                <td key={year.yearIndex} className="p-2 text-right tabular-nums text-foreground">
                  {formatPercent(year.ebitdaMarginPct)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-border">
              <td className="sticky left-0 bg-card p-2 text-foreground">Net margin</td>
              {years.map((year) => (
                <td key={year.yearIndex} className="p-2 text-right tabular-nums text-foreground">
                  {formatPercent(year.netRevenue > 0 ? (year.netProfit / year.netRevenue) * 100 : 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
