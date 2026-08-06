'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericCell } from '@/components/ui/numeric-cell'
import { OpexGroupSchema } from '@/domain/costs'
import { StaffSectionSchema, type Project } from '@/domain/schema'
import type { CostForecast, YearStatement } from '@/engine/costs'
import { cn } from '@/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { OPEX_GROUP_LABELS } from '@/lib/expenses-data'
import { formatMoney, formatMoneySigned, formatPercent } from '@/lib/format'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'

type RowKey = 'netRevenue' | 'payroll' | 'opex' | 'stm' | 'ebitda' | 'depreciation' | 'ebit' | 'tax' | 'netProfit'
type ExpandableKey = 'payroll' | 'opex'

const BASE_ROWS: Array<{ key: RowKey; label: string; emphasis?: boolean; expandable?: ExpandableKey }> = [
  { key: 'netRevenue', label: 'Net revenue' },
  { key: 'payroll', label: 'Payroll', expandable: 'payroll' },
  { key: 'opex', label: 'Operating expenses', expandable: 'opex' },
  { key: 'stm', label: 'STM share' },
  { key: 'ebitda', label: 'EBITDA', emphasis: true },
  { key: 'depreciation', label: 'Depreciation' },
  { key: 'ebit', label: 'EBIT', emphasis: true },
  { key: 'tax', label: 'Tax' },
  { key: 'netProfit', label: 'Net profit', emphasis: true },
]

interface PLRow {
  key: string
  label: string
  emphasis?: boolean
  indent?: boolean
  expandable?: ExpandableKey
  isExpanded?: boolean
  valueKind: 'money' | 'percent'
  getYearValue: (year: YearStatement) => number
}

export function ProfitAndLossTable({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const [expanded, setExpanded] = useState<Set<ExpandableKey>>(new Set())
  const years = costForecast.years

  const toggle = (key: ExpandableKey) => {
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
    const body: string[][] = BASE_ROWS.map((row) => [
      row.label,
      ...years.map((year) => formatMoneySigned(year[row.key], project.meta)),
    ])
    body.push(['EBITDA margin', ...years.map((year) => formatPercent(year.ebitdaMarginPct))])
    body.push([
      'Net margin',
      ...years.map((year) => formatPercent(year.netRevenue > 0 ? (year.netProfit / year.netRevenue) * 100 : 0)),
    ])
    downloadCsv(`${project.meta.schoolName} - profit and loss.csv`, [header, ...body])
  }

  const rows: PLRow[] = []
  for (const base of BASE_ROWS) {
    rows.push({
      key: base.key,
      label: base.label,
      emphasis: base.emphasis,
      expandable: base.expandable,
      isExpanded: base.expandable ? expanded.has(base.expandable) : undefined,
      valueKind: 'money',
      getYearValue: (year) => year[base.key],
    })
    if (base.expandable === 'payroll' && expanded.has('payroll')) {
      for (const section of StaffSectionSchema.options) {
        rows.push({
          key: `payroll-${section}`,
          label: STAFF_SECTION_LABELS[section] ?? section,
          indent: true,
          valueKind: 'money',
          getYearValue: (year) => payrollBySection(year.yearIndex).find((entry) => entry.section === section)?.total ?? 0,
        })
      }
    }
    if (base.expandable === 'opex' && expanded.has('opex')) {
      for (const group of OpexGroupSchema.options) {
        rows.push({
          key: `opex-${group}`,
          label: OPEX_GROUP_LABELS[group],
          indent: true,
          valueKind: 'money',
          getYearValue: (year) => year.opexByGroup[group] ?? 0,
        })
      }
    }
  }
  rows.push({
    key: 'ebitdaMargin',
    label: 'EBITDA margin',
    valueKind: 'percent',
    getYearValue: (year) => year.ebitdaMarginPct,
  })
  rows.push({
    key: 'netMargin',
    label: 'Net margin',
    valueKind: 'percent',
    getYearValue: (year) => (year.netRevenue > 0 ? (year.netProfit / year.netRevenue) * 100 : 0),
  })

  const columns: GridColumnDef<PLRow>[] = [
    {
      id: 'label',
      label: 'Line',
      kind: 'readonly',
      width: 220,
      minWidth: 180,
      pinned: 'left',
      getValue: (row) => row.label,
      render: (row) => (
        <button
          type="button"
          className={cn('flex w-full items-center gap-1.5 text-left', row.indent && 'pl-6', !row.expandable && 'cursor-default')}
          onClick={row.expandable ? () => toggle(row.expandable!) : undefined}
        >
          {row.expandable ? (
            row.isExpanded ? (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            )
          ) : null}
          <span className="truncate">{row.label}</span>
        </button>
      ),
    },
    ...years.map(
      (year): GridColumnDef<PLRow> => ({
        id: `year-${year.yearIndex}`,
        label: year.label,
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: (row) => row.getYearValue(year),
        render: (row) => {
          const raw = row.getYearValue(year)
          return row.valueKind === 'percent' ? (
            <span>{formatPercent(raw)}</span>
          ) : (
            <NumericCell value={raw} formatted={formatMoney(raw, project.meta)} />
          )
        },
      }),
    ),
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Profit and loss</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <DataGrid
          rows={rows}
          getRowId={(row) => row.key}
          columns={columns}
          mode="display"
          gridId="statements-profit-and-loss"
          ariaLabel="Profit and loss"
          getRowClassName={(row) => (row.emphasis ? 'font-semibold' : undefined)}
        />
      </CardContent>
    </Card>
  )
}
