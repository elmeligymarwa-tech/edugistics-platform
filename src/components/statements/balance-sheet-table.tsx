'use client'

import { Download } from 'lucide-react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericCell } from '@/components/ui/numeric-cell'
import type { Project } from '@/domain/schema'
import type { CapitalForecast, YearCapital } from '@/engine/capital'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { formatMoney, formatMoneySigned } from '@/lib/format'

const BALANCE_TOLERANCE = 0.5

type RowKey =
  | 'fixedAssetsNet'
  | 'receivables'
  | 'closingCash'
  | 'totalAssets'
  | 'payables'
  | 'debt'
  | 'totalLiabilities'
  | 'shareCapital'
  | 'retainedEarnings'
  | 'totalEquity'
  | 'balanceCheck'

interface BalanceRow {
  key: RowKey
  label: string
  emphasis?: boolean
  isCheck?: boolean
  getYearValue: (year: YearCapital) => number
}

const ROWS: BalanceRow[] = [
  { key: 'fixedAssetsNet', label: 'Fixed assets (net)', getYearValue: (year) => year.fixedAssetsNet },
  { key: 'receivables', label: 'Receivables', getYearValue: (year) => year.receivables },
  { key: 'closingCash', label: 'Cash', getYearValue: (year) => year.closingCash },
  { key: 'totalAssets', label: 'Total assets', emphasis: true, getYearValue: (year) => year.totalAssets },
  { key: 'payables', label: 'Payables', getYearValue: (year) => year.payables },
  { key: 'debt', label: 'Debt', getYearValue: (year) => year.debt },
  { key: 'totalLiabilities', label: 'Total liabilities', emphasis: true, getYearValue: (year) => year.totalLiabilities },
  { key: 'shareCapital', label: 'Share capital', getYearValue: (year) => year.shareCapital },
  { key: 'retainedEarnings', label: 'Retained earnings', getYearValue: (year) => year.retainedEarnings },
  { key: 'totalEquity', label: 'Total equity', emphasis: true, getYearValue: (year) => year.totalEquity },
  { key: 'balanceCheck', label: 'Balance check', emphasis: true, isCheck: true, getYearValue: (year) => year.balanceCheck },
]

export function BalanceSheetTable({
  project,
  capitalForecast,
}: {
  project: Project
  capitalForecast: CapitalForecast
}) {
  const years = capitalForecast.years

  const handleExport = () => {
    const header = ['', ...years.map((year) => year.label)]
    const body: string[][] = ROWS.map((row) => [
      row.label,
      ...years.map((year) => formatMoneySigned(row.getYearValue(year), project.meta)),
    ])
    downloadCsv(`${project.meta.schoolName} - balance sheet.csv`, [header, ...body])
  }

  const columns: GridColumnDef<BalanceRow>[] = [
    {
      id: 'label',
      label: 'Line',
      kind: 'readonly',
      width: 200,
      minWidth: 160,
      pinned: 'left',
      getValue: (row) => row.label,
    },
    ...years.map(
      (year): GridColumnDef<BalanceRow> => ({
        id: `year-${year.yearIndex}`,
        label: year.label,
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: (row) => row.getYearValue(year),
        render: (row) => {
          const raw = row.getYearValue(year)
          const fails = row.isCheck && Math.abs(raw) > BALANCE_TOLERANCE
          return (
            <NumericCell
              value={raw}
              formatted={formatMoney(raw, project.meta)}
              className={cn(fails && 'font-semibold text-destructive')}
            />
          )
        },
      }),
    ),
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Balance sheet</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <DataGrid
          rows={ROWS}
          getRowId={(row) => row.key}
          columns={columns}
          mode="display"
          gridId="statements-balance-sheet"
          ariaLabel="Balance sheet"
          getRowClassName={(row) => (row.emphasis ? 'font-semibold' : undefined)}
        />
      </CardContent>
    </Card>
  )
}
