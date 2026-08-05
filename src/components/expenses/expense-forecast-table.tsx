'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OpexGroupSchema, type OpexCategory } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { downloadCsv } from '@/lib/csv'
import { OPEX_BASIS_LABELS, OPEX_GROUP_LABELS } from '@/lib/expenses-data'
import { formatMoney, formatPercent } from '@/lib/format'

export function ExpenseForecastTable({
  project,
  opex,
  costForecast,
}: {
  project: Project
  opex: OpexCategory[]
  costForecast: CostForecast
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const years = costForecast.years

  const toggle = (group: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const handleExport = () => {
    const header = ['', ...years.map((year) => year.label)]
    const body: string[][] = []

    for (const group of OpexGroupSchema.options) {
      const categories = opex.filter((category) => category.group === group)
      if (categories.length === 0) continue
      body.push([
        OPEX_GROUP_LABELS[group],
        ...years.map((year) => formatMoney(year.opexByGroup[group] ?? 0, project.meta)),
      ])
      for (const category of categories) {
        body.push([`  ${category.name} (${OPEX_BASIS_LABELS[category.basis]})`, ...years.map(() => '')])
      }
    }
    body.push(['Total operating expenses', ...years.map((year) => formatMoney(year.opex, project.meta))])

    downloadCsv(`${project.meta.schoolName} - expense forecast.csv`, [header, ...body])
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Expense forecast</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="max-h-[32rem] overflow-auto pt-0">
        {opex.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expense categories configured yet.</p>
        ) : (
          <table className="data-table w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">
                  Group
                </th>
                {years.map((year) => (
                  <th key={year.yearIndex} className="p-2 text-right font-medium text-muted-foreground">
                    {year.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OpexGroupSchema.options.map((group) => {
                const categories = opex.filter((category) => category.group === group)
                if (categories.length === 0) return null
                const isExpanded = expanded.has(group)
                return (
                  <Fragment key={group}>
                    <tr className="border-t border-border">
                      <td className="sticky left-0 bg-card p-2 font-medium text-foreground">
                        <button type="button" className="flex items-center gap-1.5" onClick={() => toggle(group)}>
                          {isExpanded ? (
                            <ChevronDown className="size-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 text-muted-foreground" />
                          )}
                          {OPEX_GROUP_LABELS[group]}
                        </button>
                      </td>
                      {years.map((year) => (
                        <td key={year.yearIndex} className="p-2 text-right tabular-nums text-foreground">
                          {formatMoney(year.opexByGroup[group] ?? 0, project.meta)}
                        </td>
                      ))}
                    </tr>
                    {isExpanded
                      ? categories.map((category) => (
                          <tr key={category.id} className="border-t border-border/50">
                            <td
                              colSpan={years.length + 1}
                              className="sticky left-0 bg-card py-1.5 pr-2 pl-8 text-muted-foreground"
                            >
                              {category.name} — {OPEX_BASIS_LABELS[category.basis]},{' '}
                              {formatMoney(category.amount, project.meta)}
                              {category.basis === 'pctOfRevenue' ? '' : ' base'}, escalation{' '}
                              {formatPercent(
                                Array.isArray(category.escalationPct)
                                  ? (category.escalationPct[0] ?? 0)
                                  : category.escalationPct,
                              )}
                              {category.endYearIndex !== null
                                ? `, years ${category.startYearIndex + 1}–${category.endYearIndex + 1}`
                                : `, from year ${category.startYearIndex + 1}`}
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                )
              })}
              <tr className="border-t border-border">
                <td className="sticky left-0 bg-card p-2 font-semibold text-foreground">
                  Total operating expenses
                </td>
                {years.map((year) => (
                  <td key={year.yearIndex} className="p-2 text-right font-semibold tabular-nums text-foreground">
                    {formatMoney(year.opex, project.meta)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
