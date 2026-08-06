'use client'

import { Download } from 'lucide-react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { GlossaryHint } from '@/components/glossary/glossary-hint'
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
  term?: string
  getYearValue: (year: YearCapital) => number
}

const ROWS: BalanceRow[] = [
  { key: 'fixedAssetsNet', label: 'Fixed assets (net)', getYearValue: (year) => year.fixedAssetsNet },
  { key: 'receivables', label: 'Receivables', term: 'receivables', getYearValue: (year) => year.receivables },
  { key: 'closingCash', label: 'Cash', term: 'closing-cash', getYearValue: (year) => year.closingCash },
  { key: 'totalAssets', label: 'Total assets', emphasis: true, term: 'total-assets', getYearValue: (year) => year.totalAssets },
  { key: 'payables', label: 'Payables', term: 'payables', getYearValue: (year) => year.payables },
  { key: 'debt', label: 'Debt', getYearValue: (year) => year.debt },
  {
    key: 'totalLiabilities',
    label: 'Total liabilities',
    emphasis: true,
    term: 'total-liabilities',
    getYearValue: (year) => year.totalLiabilities,
  },
  { key: 'shareCapital', label: 'Share capital', term: 'share-capital', getYearValue: (year) => year.shareCapital },
  {
    key: 'retainedEarnings',
    label: 'Retained earnings',
    term: 'retained-earnings',
    getYearValue: (year) => year.retainedEarnings,
  },
  { key: 'totalEquity', label: 'Total equity', emphasis: true, term: 'total-equity', getYearValue: (year) => year.totalEquity },
  {
    key: 'balanceCheck',
    label: 'Balance check',
    emphasis: true,
    isCheck: true,
    term: 'balance-check',
    getYearValue: (year) => year.balanceCheck,
  },
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
      render: (row) => {
        const lastYear = years[years.length - 1]
        return (
          <div className="flex w-full items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.term ? (
              <GlossaryHint
                term={row.term}
                currentValue={lastYear ? formatMoney(row.getYearValue(lastYear), project.meta).text : undefined}
                context={`Balance sheet, ${lastYear?.label ?? 'final forecast year'}`}
              />
            ) : null}
          </div>
        )
      },
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
