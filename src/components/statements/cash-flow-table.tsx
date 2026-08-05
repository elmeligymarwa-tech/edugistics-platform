'use client'

import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project } from '@/domain/schema'
import type { CostForecast, YearStatement } from '@/engine/costs'
import { downloadCsv } from '@/lib/csv'
import { formatMoney } from '@/lib/format'

type RowKey = 'cashCollected' | 'cashCostsPaid' | 'capexSpend' | 'taxPaid' | 'netCashMovement' | 'closingCash'

const ROWS: Array<{ key: RowKey; label: string; emphasis?: boolean }> = [
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
      ...years.map((year) => formatMoney(year[row.key], project.meta)),
    ])
    downloadCsv(`${project.meta.schoolName} - cash flow.csv`, [header, ...body])
  }

  const rowValue = (row: (typeof ROWS)[number], year: YearStatement) => year[row.key]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Cash flow</CardTitle>
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
            {ROWS.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td
                  className={`sticky left-0 bg-card p-2 text-foreground ${row.emphasis ? 'font-semibold' : 'font-medium'}`}
                >
                  {row.label}
                </td>
                {years.map((year) => (
                  <td
                    key={year.yearIndex}
                    className={`p-2 text-right tabular-nums text-foreground ${row.emphasis ? 'font-semibold' : ''}`}
                  >
                    {formatMoney(rowValue(row, year), project.meta)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
