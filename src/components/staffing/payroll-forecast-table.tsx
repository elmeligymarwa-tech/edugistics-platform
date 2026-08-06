'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { DataGrid, type GridColumnDef, type GridRowGroup } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericCell } from '@/components/ui/numeric-cell'
import { StaffSectionSchema, type Project } from '@/domain/schema'
import type { CostForecast, PayrollLine, YearPayroll } from '@/engine/costs'
import { cn } from '@/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { formatMoney, formatMoneySigned, formatNumber } from '@/lib/format'
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

interface PayrollRow {
  key: string
  label: string
  indent?: boolean
  expandable?: boolean
  isExpanded?: boolean
  positionId?: string
  emphasis?: boolean
  valueKind: 'money' | 'number'
  getYearValue: (year: YearPayroll) => number
}

export function PayrollForecastTable({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
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
          ...years.map((year) => formatMoneySigned(lineFor(year.lines, position.id)?.total ?? 0, project.meta)),
        ])
        for (const detail of DETAIL_ROWS) {
          body.push([
            `  ${detail.label}`,
            ...years.map((year) => formatMoneySigned(lineFor(year.lines, position.id)?.[detail.key] ?? 0, project.meta)),
          ])
        }
      }
    }
    body.push(['Total payroll', ...years.map((year) => formatMoneySigned(year.total, project.meta))])

    downloadCsv(`${project.meta.schoolName} - payroll forecast.csv`, [header, ...body])
  }

  const rowGroups: GridRowGroup<PayrollRow>[] = []
  for (const section of StaffSectionSchema.options) {
    const positions = project.staffing.positions.filter((position) => position.section === section)
    if (positions.length === 0) continue
    const sectionRows: PayrollRow[] = []
    for (const position of positions) {
      const isExpanded = expanded.has(position.id)
      sectionRows.push({
        key: position.id,
        label: position.title,
        expandable: true,
        isExpanded,
        positionId: position.id,
        valueKind: 'money',
        getYearValue: (year) => lineFor(year.lines, position.id)?.total ?? 0,
      })
      if (isExpanded) {
        for (const detail of DETAIL_ROWS) {
          sectionRows.push({
            key: `${position.id}-${detail.key}`,
            label: detail.label,
            indent: true,
            valueKind: 'money',
            getYearValue: (year) => lineFor(year.lines, position.id)?.[detail.key] ?? 0,
          })
        }
        sectionRows.push({
          key: `${position.id}-headcount`,
          label: 'Headcount',
          indent: true,
          valueKind: 'number',
          getYearValue: (year) => lineFor(year.lines, position.id)?.headcount ?? 0,
        })
      }
    }
    rowGroups.push({ id: section, label: STAFF_SECTION_LABELS[section] ?? section, rows: sectionRows })
  }

  const totalRow: PayrollRow[] = [
    { key: 'total', label: 'Total payroll', emphasis: true, valueKind: 'money', getYearValue: (year) => year.total },
  ]

  const columns: GridColumnDef<PayrollRow>[] = [
    {
      id: 'label',
      label: 'Position',
      kind: 'readonly',
      width: 220,
      minWidth: 180,
      pinned: 'left',
      getValue: (row) => row.label,
      render: (row) => (
        <button
          type="button"
          className={cn('flex w-full items-center gap-1.5 text-left', row.indent && 'pl-6', !row.expandable && 'cursor-default')}
          onClick={row.expandable ? () => toggle(row.positionId!) : undefined}
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
      (year): GridColumnDef<PayrollRow> => ({
        id: `year-${year.yearIndex}`,
        label: `Year ${year.yearIndex + 1}`,
        kind: 'readonly',
        width: 112,
        minWidth: 100,
        getValue: (row) => row.getYearValue(year),
        render: (row) => {
          const raw = row.getYearValue(year)
          return row.valueKind === 'number' ? (
            <span>{formatNumber(raw, project.meta.locale)}</span>
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
        <CardTitle>Payroll forecast</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <DataGrid
          rows={rowGroups}
          getRowId={(row) => row.key}
          columns={columns}
          mode="display"
          gridId="staffing-payroll-forecast"
          ariaLabel="Payroll forecast"
        />
        <DataGrid
          rows={totalRow}
          getRowId={(row) => row.key}
          columns={columns}
          mode="display"
          gridId="staffing-payroll-total"
          ariaLabel="Total payroll"
          getRowClassName={(row) => (row.emphasis ? 'font-semibold' : undefined)}
        />
      </CardContent>
    </Card>
  )
}
