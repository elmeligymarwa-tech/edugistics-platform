'use client'

import { Plus, Sparkles, Trash2 } from 'lucide-react'

import { DataGrid, toNumberOrZero, type GridColumnDef } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { OpexGroupSchema, type OpexCategory } from '@/domain/costs'
import { OPEX_BASIS_LABELS, OPEX_GROUP_LABELS, STARTER_OPEX_CATEGORIES } from '@/lib/expenses-data'
import { useProjectStore } from '@/store/project-store'

const GROUP_OPTIONS = OpexGroupSchema.options.map((group) => ({
  value: group,
  label: OPEX_GROUP_LABELS[group],
}))
const BASIS_OPTIONS = Object.entries(OPEX_BASIS_LABELS).map(([value, label]) => ({ value, label }))

function createOpexCategory(): OpexCategory {
  return {
    id: globalThis.crypto.randomUUID(),
    name: 'New category',
    group: 'other',
    basis: 'fixed',
    amount: 0,
    escalationPct: 0,
    startYearIndex: 0,
    endYearIndex: null,
  }
}

export function OpexCategoryEditor({ projectId, opex }: { projectId: string; opex: OpexCategory[] }) {
  const updateOpex = useProjectStore((state) => state.updateOpex)

  const addCategory = () => updateOpex(projectId, [...opex, createOpexCategory()])

  const addStarterCategories = () => {
    const existingIds = new Set(opex.map((category) => category.id))
    const additions = STARTER_OPEX_CATEGORIES.filter((category) => !existingIds.has(category.id))
    if (additions.length > 0) updateOpex(projectId, [...opex, ...additions])
  }

  const updateCategory = (id: string, patch: Partial<OpexCategory>) =>
    updateOpex(
      projectId,
      opex.map((category) => (category.id === id ? { ...category, ...patch } : category)),
    )

  const removeCategory = (id: string) => updateOpex(projectId, opex.filter((category) => category.id !== id))

  const columns: GridColumnDef<OpexCategory>[] = [
    {
      id: 'name',
      label: 'Name',
      kind: 'text',
      width: 200,
      minWidth: 160,
      pinned: 'left',
      getValue: (category) => category.name,
      onCommit: (category, value) => updateCategory(category.id, { name: typeof value === 'string' ? value : '' }),
      render: (category) => (
        <div className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">{category.name}</span>
          <button
            type="button"
            aria-label={`Remove ${category.name}`}
            onClick={() => removeCategory(category.id)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
    {
      id: 'group',
      label: 'Group',
      kind: 'select',
      width: 140,
      minWidth: 120,
      selectOptions: GROUP_OPTIONS,
      getValue: (category) => category.group,
      onCommit: (category, value) => updateCategory(category.id, { group: value as OpexCategory['group'] }),
    },
    {
      id: 'basis',
      label: 'Basis',
      kind: 'select',
      width: 140,
      minWidth: 128,
      selectOptions: BASIS_OPTIONS,
      getValue: (category) => category.basis,
      onCommit: (category, value) => updateCategory(category.id, { basis: value as OpexCategory['basis'] }),
    },
    {
      id: 'amount',
      label: 'Amount',
      kind: 'numeric',
      width: 128,
      minWidth: 104,
      allowFillDown: true,
      allowUplift: true,
      getValue: (category) => category.amount,
      onCommit: (category, value) => updateCategory(category.id, { amount: toNumberOrZero(value) }),
    },
    {
      id: 'escalationPct',
      label: 'Escalation %',
      kind: 'percent',
      width: 116,
      minWidth: 100,
      allowFillDown: true,
      getValue: (category) => (Array.isArray(category.escalationPct) ? (category.escalationPct[0] ?? 0) : category.escalationPct),
      onCommit: (category, value) => updateCategory(category.id, { escalationPct: toNumberOrZero(value) }),
    },
    {
      id: 'startYearIndex',
      label: 'Start year',
      kind: 'numeric',
      width: 100,
      minWidth: 92,
      getValue: (category) => category.startYearIndex + 1,
      onCommit: (category, value) => updateCategory(category.id, { startYearIndex: Math.max(0, toNumberOrZero(value) - 1) }),
    },
    {
      id: 'endYearIndex',
      label: 'End year',
      kind: 'numeric',
      width: 100,
      minWidth: 92,
      getValue: (category) => (category.endYearIndex !== null ? category.endYearIndex + 1 : null),
      onCommit: (category, value) =>
        updateCategory(category.id, { endYearIndex: typeof value === 'number' ? Math.max(0, Math.round(value) - 1) : null }),
    },
  ]

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">Expense categories</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addStarterCategories}>
            <Sparkles data-icon="inline-start" />
            Add starter categories
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addCategory}>
            <Plus data-icon="inline-start" />
            Add category
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {opex.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expense categories yet.</p>
        ) : (
          <DataGrid
            rows={opex}
            getRowId={(category) => category.id}
            columns={columns}
            mode="edit"
            gridId="expenses-opex"
            ariaLabel="Expense categories"
          />
        )}
      </CardContent>
    </Card>
  )
}
