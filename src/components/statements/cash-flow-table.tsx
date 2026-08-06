'use client'

import { Download } from 'lucide-react'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { downloadCsv } from '@/lib/csv'
import { formatMoney, formatMoneySigned } from '@/lib/format'

type RowKey = 'cashCollected' | 'cashCostsPaid' | 'capexSpend' | 'taxPaid' | 'netCashMovement' | 'closingCash'

interface CashFlowRow {
  key: RowKey
  label: string
  emphasis?: boolean
}

const ROWS: CashFlowRow[] = [
  { key: 'cashCollected', label: 'Cash collected' },
  { key: 'cashCostsPaid', label: 'Cash costs paid' },
  { key: 'capexSpend', label: 'Capital expenditure' },
  { key: 'taxPaid', label: 'Tax paid' },
  { key: 'netCashMovement', label: 'Net movement', emphasis: true },
  { key: 'closingCash', label: 'Closing cash', emphasis: true },
]

export function CashFlowTable({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const years = costForecast.years

  const handleExport = () => {
    const header = ['', ...years.map((year) => year.label)]
    const body: string[][] = ROWS.map((row) => [
      row.label,
      ...years.map((year) => formatMoneySigned(year[row.key], project.meta)),
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
    },
    ...years.map(
      (year): GridColumnDef<CashFlowRow> => ({
        id: `year-${year.yearIndex}`,
        label: year.label,
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: (row) => year[row.key],
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
          rows={ROWS}
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
