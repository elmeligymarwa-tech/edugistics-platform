'use client'

import { DataGrid, type GridColumnDef } from '@/components/grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericCell } from '@/components/ui/numeric-cell'
import type { ProjectMeta } from '@/domain/schema'
import type { SensitivityGrid as SensitivityGridData } from '@/lib/sensitivity'
import { cn } from '@/lib/utils'
import { formatCompactMoney, formatPercent } from '@/lib/format'

interface SensitivityRow {
  key: string
  rowIndex: number
  rowValue: number
  values: number[]
}

export function SensitivityGrid({ meta, grid }: { meta: ProjectMeta; grid: SensitivityGridData }) {
  const centerRow = Math.floor(grid.rowValues.length / 2)
  const centerCol = Math.floor(grid.colValues.length / 2)

  const rows: SensitivityRow[] = grid.rowValues.map((rowValue, rowIndex) => ({
    key: `row-${rowIndex}`,
    rowIndex,
    rowValue,
    values: grid.equityValues[rowIndex] ?? [],
  }))

  const columns: GridColumnDef<SensitivityRow>[] = [
    {
      id: 'label',
      label: grid.rowLabel,
      kind: 'readonly',
      width: 128,
      minWidth: 112,
      pinned: 'left',
      getValue: (row) => formatPercent(row.rowValue),
    },
    ...grid.colValues.map(
      (colValue, colIndex): GridColumnDef<SensitivityRow> => ({
        id: `col-${colIndex}`,
        label: grid.colLabel === 'Exit multiple' ? `${colValue.toFixed(1)}x` : formatPercent(colValue),
        kind: 'readonly',
        width: 108,
        minWidth: 96,
        getValue: (row) => row.values[colIndex] ?? 0,
        render: (row) => {
          const raw = row.values[colIndex] ?? 0
          const isBaseCase = colIndex === centerCol && row.rowIndex === centerRow
          return (
            <NumericCell
              value={raw}
              formatted={formatCompactMoney(raw, meta)}
              className={cn(isBaseCase && 'font-semibold text-primary')}
            />
          )
        },
      }),
    ),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equity value sensitivity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <DataGrid
          rows={rows}
          getRowId={(row) => row.key}
          columns={columns}
          mode="display"
          gridId="valuation-sensitivity-grid"
          ariaLabel="Equity value sensitivity grid"
        />
      </CardContent>
    </Card>
  )
}
