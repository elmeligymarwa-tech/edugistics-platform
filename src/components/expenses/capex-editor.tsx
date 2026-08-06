'use client'

import { Plus, Trash2 } from 'lucide-react'

import { DataGrid, toNumberOrZero, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { CapexItem } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatMoney } from '@/lib/format'
import { useProjectStore } from '@/store/project-store'

interface DepreciationRow {
  key: 'depreciation'
  label: string
}

function createCapexItem(): CapexItem {
  return {
    id: globalThis.crypto.randomUUID(),
    name: 'New item',
    amount: 0,
    yearIndex: 0,
    usefulLifeYears: 5,
    method: 'straightLine',
  }
}

export function CapexEditor({
  project,
  capex,
  costForecast,
}: {
  project: Project
  capex: CapexItem[]
  costForecast: CostForecast
}) {
  const updateCapex = useProjectStore((state) => state.updateCapex)

  const addItem = () => updateCapex(project.id, [...capex, createCapexItem()])

  const updateItem = (id: string, patch: Partial<CapexItem>) =>
    updateCapex(
      project.id,
      capex.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeItem = (id: string) => updateCapex(project.id, capex.filter((item) => item.id !== id))

  const itemColumns: GridColumnDef<CapexItem>[] = [
    {
      id: 'name',
      label: 'Name',
      kind: 'text',
      width: 220,
      minWidth: 180,
      pinned: 'left',
      getValue: (item) => item.name,
      onCommit: (item, value) => updateItem(item.id, { name: typeof value === 'string' ? value : '' }),
      render: (item) => (
        <div className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <button
            type="button"
            aria-label={`Remove ${item.name}`}
            onClick={() => removeItem(item.id)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
    {
      id: 'amount',
      label: 'Amount',
      kind: 'numeric',
      width: 128,
      minWidth: 108,
      allowFillDown: true,
      allowUplift: true,
      getValue: (item) => item.amount,
      onCommit: (item, value) => updateItem(item.id, { amount: toNumberOrZero(value) }),
    },
    {
      id: 'yearIndex',
      label: 'Forecast year',
      kind: 'numeric',
      width: 116,
      minWidth: 104,
      getValue: (item) => item.yearIndex + 1,
      onCommit: (item, value) => updateItem(item.id, { yearIndex: Math.max(0, toNumberOrZero(value) - 1) }),
    },
    {
      id: 'usefulLifeYears',
      label: 'Useful life (years)',
      kind: 'numeric',
      width: 140,
      minWidth: 120,
      getValue: (item) => item.usefulLifeYears,
      onCommit: (item, value) => updateItem(item.id, { usefulLifeYears: Math.max(1, toNumberOrZero(value)) }),
    },
  ]

  const depreciationRows: DepreciationRow[] = [{ key: 'depreciation', label: 'Straight line depreciation' }]
  const depreciationColumns: GridColumnDef<DepreciationRow>[] = [
    {
      id: 'label',
      label: 'Depreciation schedule',
      kind: 'readonly',
      width: 220,
      minWidth: 180,
      pinned: 'left',
      getValue: (row) => row.label,
    },
    ...costForecast.years.map(
      (year): GridColumnDef<DepreciationRow> => ({
        id: `year-${year.yearIndex}`,
        label: year.label,
        kind: 'readonly',
        width: 128,
        minWidth: 112,
        getValue: () => year.depreciation,
        format: (value) => (typeof value === 'number' ? formatMoney(value, project.meta) : ''),
      }),
    ),
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Capital expenditure</h3>
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus data-icon="inline-start" />
          Add item
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {capex.length === 0 ? (
          <p className="text-sm text-muted-foreground">No capital expenditure items yet.</p>
        ) : (
          <DataGrid
            rows={capex}
            getRowId={(item) => item.id}
            columns={itemColumns}
            mode="edit"
            gridId="expenses-capex-items"
            ariaLabel="Capital expenditure items"
          />
        )}
      </CardContent>
      {capex.length > 0 ? (
        <CardContent className="pt-0">
          <DataGrid
            rows={depreciationRows}
            getRowId={(row) => row.key}
            columns={depreciationColumns}
            mode="display"
            gridId="expenses-capex-depreciation"
            ariaLabel="Depreciation schedule"
          />
        </CardContent>
      ) : null}
    </Card>
  )
}
