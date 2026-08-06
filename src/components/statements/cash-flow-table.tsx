'use client'

import { Download } from 'lucide-react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { GlossaryHint } from '@/components/glossary/glossary-hint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import type { CapitalForecast } from '@/engine/capital'
import { downloadCsv } from '@/lib/csv'
import { formatMoney, formatMoneySigned } from '@/lib/format'

type CostRowKey = 'cashCollected' | 'cashCostsPaid' | 'capexSpend'
type CapitalRowKey =
  | 'interest'
  | 'drawdowns'
  | 'principalRepaid'
  | 'equityInjected'
  | 'dividend'
  | 'netCashMovement'
  | 'closingCash'

const COST_ROWS: Array<{ key: CostRowKey; label: string; term?: string }> = [
  { key: 'cashCollected', label: 'Cash collected' },
  { key: 'cashCostsPaid', label: 'Cash costs paid' },
  { key: 'capexSpend', label: 'Capital expenditure', term: 'capital-expenditure' },
]

/** Once financing exists, tax, interest and every below-the-line flow come from the capital forecast, which is the layer that accounts for them. */
const CAPITAL_ROWS: Array<{ key: CapitalRowKey; label: string; emphasis?: boolean; term?: string }> = [
  { key: 'interest', label: 'Interest paid' },
  { key: 'drawdowns', label: 'Loan drawdowns' },
  { key: 'principalRepaid', label: 'Loan repayments' },
  { key: 'equityInjected', label: 'Equity injected' },
  { key: 'dividend', label: 'Dividends paid', term: 'dividend-payout' },
  { key: 'netCashMovement', label: 'Net movement', emphasis: true, term: 'cash-flow' },
  { key: 'closingCash', label: 'Closing cash', emphasis: true, term: 'closing-cash' },
]

interface CashFlowRow {
  key: string
  label: string
  emphasis?: boolean
  term?: string
  getYearValue: (yearIndex: number) => number
}

export function CashFlowTable({
  project,
  costForecast,
  capitalForecast,
}: {
  project: Project
  costForecast: CostForecast
  capitalForecast: CapitalForecast
}) {
  const years = costForecast.years
  const capitalYears = capitalForecast.years

  const rows: CashFlowRow[] = [
    ...COST_ROWS.map((row) => ({
      key: row.key,
      label: row.label,
      term: row.term,
      getYearValue: (yearIndex: number) => years[yearIndex]?.[row.key] ?? 0,
    })),
    ...CAPITAL_ROWS.map((row) => ({
      key: row.key,
      label: row.label,
      emphasis: row.emphasis,
      term: row.term,
      getYearValue: (yearIndex: number) => capitalYears[yearIndex]?.[row.key] ?? 0,
    })),
  ]

  const handleExport = () => {
    const header = ['', ...years.map((year) => year.label)]
    const body: string[][] = rows.map((row) => [
      row.label,
      ...years.map((year) => formatMoneySigned(row.getYearValue(year.yearIndex), project.meta)),
    ])
    downloadCsv(`${project.meta.schoolName} - cash flow.csv`, [header, ...body])
  }

  const columns: GridColumnDef<CashFlowRow>[] = [
    {
      id: 'label',
      label: 'Line',
      kind: 'readonly',
      width: 200,
      minWidth: 160,
      pinned: 'left',
      getValue: (row) => row.label,
      render: (row) => (
        <div className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">{row.label}</span>
          {row.term ? (
            <GlossaryHint
              term={row.term}
              currentValue={formatMoney(row.getYearValue(years.length - 1), project.meta).text}
              context={`Cash flow, ${years[years.length - 1]?.label ?? 'final forecast year'}`}
            />
          ) : null}
        </div>
      ),
    },
    ...years.map(
      (year): GridColumnDef<CashFlowRow> => ({
        id: `year-${year.yearIndex}`,
        label: year.label,
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: (row) => row.getYearValue(year.yearIndex),
        format: (value) => (typeof value === 'number' ? formatMoney(value, project.meta) : ''),
      }),
    ),
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Cash flow</CardTitle>
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
          gridId="statements-cash-flow"
          ariaLabel="Cash flow"
          getRowClassName={(row) => (row.emphasis ? 'font-semibold' : undefined)}
        />
      </CardContent>
    </Card>
  )
}
