'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { GlossaryHint } from '@/components/glossary/glossary-hint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericCell } from '@/components/ui/numeric-cell'
import { OpexGroupSchema } from '@/domain/costs'
import { StaffSectionSchema, type Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import type { CapitalForecast } from '@/engine/capital'
import { cn } from '@/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { OPEX_GROUP_LABELS } from '@/lib/expenses-data'
import { formatMoney, formatMoneySigned, formatPercent } from '@/lib/format'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'

type CostRowKey = 'netRevenue' | 'payroll' | 'opex' | 'stm' | 'ebitda' | 'depreciation'
type CapitalRowKey = 'interest' | 'profitBeforeTax' | 'tax' | 'netProfit' | 'dividend'
type ExpandableKey = 'payroll' | 'opex'

const COST_ROWS: Array<{ key: CostRowKey; label: string; emphasis?: boolean; expandable?: ExpandableKey; term?: string }> = [
  { key: 'netRevenue', label: 'Net revenue', term: 'net-revenue' },
  { key: 'payroll', label: 'Payroll', expandable: 'payroll' },
  { key: 'opex', label: 'Operating expenses', expandable: 'opex' },
  { key: 'stm', label: 'STM share', term: 'revenue-share' },
  { key: 'ebitda', label: 'EBITDA', emphasis: true, term: 'ebitda' },
  { key: 'depreciation', label: 'Depreciation', term: 'depreciation' },
]

/** Below EBIT, the capital forecast is authoritative — its tax and net profit account for interest, which the cost forecast alone doesn't see. */
const CAPITAL_ROWS: Array<{ key: CapitalRowKey; label: string; emphasis?: boolean; term?: string }> = [
  { key: 'interest', label: 'Interest' },
  { key: 'profitBeforeTax', label: 'Profit before tax', emphasis: true, term: 'profit-before-tax' },
  { key: 'tax', label: 'Tax', term: 'corporate-tax' },
  { key: 'netProfit', label: 'Net profit', emphasis: true, term: 'net-profit' },
  { key: 'dividend', label: 'Dividend', term: 'dividend-payout' },
]

interface PLRow {
  key: string
  label: string
  emphasis?: boolean
  indent?: boolean
  expandable?: ExpandableKey
  isExpanded?: boolean
  term?: string
  valueKind: 'money' | 'percent'
  getYearValue: (yearIndex: number) => number
}

export function ProfitAndLossTable({
  project,
  costForecast,
  capitalForecast,
}: {
  project: Project
  costForecast: CostForecast
  capitalForecast: CapitalForecast
}) {
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

  const capitalYears = capitalForecast.years

  const handleExport = () => {
    const header = ['', ...years.map((year) => year.label)]
    const body: string[][] = COST_ROWS.map((row) => [
      row.label,
      ...years.map((year) => formatMoneySigned(year[row.key], project.meta)),
    ])
    body.push(['EBIT', ...years.map((year) => formatMoneySigned(year.ebit, project.meta))])
    for (const row of CAPITAL_ROWS) {
      body.push([row.label, ...capitalYears.map((year) => formatMoneySigned(year[row.key], project.meta))])
    }
    body.push(['EBITDA margin', ...years.map((year) => formatPercent(year.ebitdaMarginPct))])
    body.push([
      'Net margin',
      ...capitalYears.map((year, i) =>
        formatPercent((years[i]?.netRevenue ?? 0) > 0 ? (year.netProfit / (years[i]?.netRevenue ?? 1)) * 100 : 0),
      ),
    ])
    downloadCsv(`${project.meta.schoolName} - profit and loss.csv`, [header, ...body])
  }

  const rows: PLRow[] = []
  for (const base of COST_ROWS) {
    rows.push({
      key: base.key,
      label: base.label,
      emphasis: base.emphasis,
      expandable: base.expandable,
      isExpanded: base.expandable ? expanded.has(base.expandable) : undefined,
      term: base.term,
      valueKind: 'money',
      getYearValue: (yearIndex) => years[yearIndex]?.[base.key] ?? 0,
    })
    if (base.expandable === 'payroll' && expanded.has('payroll')) {
      for (const section of StaffSectionSchema.options) {
        rows.push({
          key: `payroll-${section}`,
          label: STAFF_SECTION_LABELS[section] ?? section,
          indent: true,
          valueKind: 'money',
          getYearValue: (yearIndex) => payrollBySection(yearIndex).find((entry) => entry.section === section)?.total ?? 0,
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
          getYearValue: (yearIndex) => years[yearIndex]?.opexByGroup[group] ?? 0,
        })
      }
    }
  }
  rows.push({
    key: 'ebit',
    label: 'EBIT',
    emphasis: true,
    term: 'ebit',
    valueKind: 'money',
    getYearValue: (yearIndex) => years[yearIndex]?.ebit ?? 0,
  })
  for (const capitalRow of CAPITAL_ROWS) {
    rows.push({
      key: capitalRow.key,
      label: capitalRow.label,
      emphasis: capitalRow.emphasis,
      term: capitalRow.term,
      valueKind: 'money',
      getYearValue: (yearIndex) => capitalYears[yearIndex]?.[capitalRow.key] ?? 0,
    })
  }
  rows.push({
    key: 'ebitdaMargin',
    label: 'EBITDA margin',
    term: 'ebitda-margin',
    valueKind: 'percent',
    getYearValue: (yearIndex) => years[yearIndex]?.ebitdaMarginPct ?? 0,
  })
  rows.push({
    key: 'netMargin',
    label: 'Net margin',
    term: 'net-margin',
    valueKind: 'percent',
    getYearValue: (yearIndex) => {
      const netRevenue = years[yearIndex]?.netRevenue ?? 0
      const netProfit = capitalYears[yearIndex]?.netProfit ?? 0
      return netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0
    },
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
      render: (row) => {
        const lastYearIndex = years.length - 1
        const lastValue = row.getYearValue(lastYearIndex)
        return (
          <div className="flex w-full items-center gap-1.5">
            <button
              type="button"
              className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-left', row.indent && 'pl-6', !row.expandable && 'cursor-default')}
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
            {row.term ? (
              <GlossaryHint
                term={row.term}
                currentValue={
                  row.valueKind === 'percent' ? formatPercent(lastValue) : formatMoney(lastValue, project.meta).text
                }
                context={`Profit and loss, ${years[lastYearIndex]?.label ?? 'final forecast year'}`}
              />
            ) : null}
          </div>
        )
      },
    },
    ...years.map(
      (year): GridColumnDef<PLRow> => ({
        id: `year-${year.yearIndex}`,
        label: year.label,
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: (row) => row.getYearValue(year.yearIndex),
        render: (row) => {
          const raw = row.getYearValue(year.yearIndex)
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
