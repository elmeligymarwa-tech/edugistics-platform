'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TruncateWithTooltip } from '@/components/ui/truncate-tooltip'
import { OpexGroupSchema, type OpexCategory } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import type { CostForecast, YearStatement } from '@/engine/costs'
import { downloadCsv } from '@/lib/csv'
import { OPEX_BASIS_LABELS, OPEX_GROUP_LABELS } from '@/lib/expenses-data'
import { formatMoney, formatMoneySigned, formatPercent } from '@/lib/format'

type OpexGroup = (typeof OpexGroupSchema.options)[number]

interface ExpenseRow {
  key: string
  type: 'group' | 'category' | 'total'
  label: string
  description?: string
  isExpanded?: boolean
  group?: OpexGroup
  emphasis?: boolean
  getYearValue?: (year: YearStatement) => number
}

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
        ...years.map((year) => formatMoneySigned(year.opexByGroup[group] ?? 0, project.meta)),
      ])
      for (const category of categories) {
        body.push([`  ${category.name} (${OPEX_BASIS_LABELS[category.basis]})`, ...years.map(() => '')])
      }
    }
    body.push(['Total operating expenses', ...years.map((year) => formatMoneySigned(year.opex, project.meta))])

    downloadCsv(`${project.meta.schoolName} - expense forecast.csv`, [header, ...body])
  }

  const describeCategory = (category: OpexCategory) => {
    const escalation = Array.isArray(category.escalationPct) ? (category.escalationPct[0] ?? 0) : category.escalationPct
    const period =
      category.endYearIndex !== null
        ? `years ${category.startYearIndex + 1}–${category.endYearIndex + 1}`
        : `from year ${category.startYearIndex + 1}`
    const base = category.basis === 'pctOfRevenue' ? '' : ' base'
    return `${category.name} — ${OPEX_BASIS_LABELS[category.basis]}, ${formatMoneySigned(category.amount, project.meta)}${base}, escalation ${formatPercent(escalation)}, ${period}`
  }

  const rows: ExpenseRow[] = []
  for (const group of OpexGroupSchema.options) {
    const categories = opex.filter((category) => category.group === group)
    if (categories.length === 0) continue
    const isExpanded = expanded.has(group)
    rows.push({
      key: group,
      type: 'group',
      label: OPEX_GROUP_LABELS[group],
      isExpanded,
      group,
      getYearValue: (year) => year.opexByGroup[group] ?? 0,
    })
    if (isExpanded) {
      for (const category of categories) {
        rows.push({ key: category.id, type: 'category', label: category.name, description: describeCategory(category) })
      }
    }
  }
  rows.push({ key: 'total', type: 'total', label: 'Total operating expenses', emphasis: true, getYearValue: (year) => year.opex })

  const columns: GridColumnDef<ExpenseRow>[] = [
    {
      id: 'label',
      label: 'Group',
      kind: 'readonly',
      width: 220,
      minWidth: 180,
      pinned: 'left',
      getValue: (row) => row.description ?? row.label,
      render: (row) => {
        if (row.type === 'category') {
          return <TruncateWithTooltip text={row.description ?? row.label} className="pl-8 text-muted-foreground" />
        }
        return (
          <button
            type="button"
            className="flex w-full items-center gap-1.5 text-left"
            onClick={row.type === 'group' ? () => toggle(row.group!) : undefined}
          >
            {row.type === 'group' ? (
              row.isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )
            ) : null}
            <span className="truncate">{row.label}</span>
          </button>
        )
      },
    },
    ...years.map(
      (year): GridColumnDef<ExpenseRow> => ({
        id: `year-${year.yearIndex}`,
        label: year.label,
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: (row) => (row.getYearValue ? row.getYearValue(year) : null),
        format: (value) => (typeof value === 'number' ? formatMoney(value, project.meta) : ''),
      }),
    ),
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Expense forecast</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {opex.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expense categories configured yet.</p>
        ) : (
          <DataGrid
            rows={rows}
            getRowId={(row) => row.key}
            columns={columns}
            mode="display"
            gridId="expenses-forecast"
            ariaLabel="Expense forecast"
            getRowClassName={(row) => (row.emphasis ? 'font-semibold' : undefined)}
          />
        )}
      </CardContent>
    </Card>
  )
}
