'use client'

import { Plus, Sparkles, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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

  const removeCategory = (id: string) =>
    updateOpex(projectId, opex.filter((category) => category.id !== id))

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Expense categories</h3>
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
      <CardContent className="flex flex-col gap-3 pt-0">
        {opex.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expense categories yet.</p>
        ) : (
          opex.map((category) => (
            <div key={category.id} className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-7 w-56"
                    value={category.name}
                    onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                  />
                  <Badge variant="outline">{OPEX_GROUP_LABELS[category.group]}</Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${category.name}`}
                  onClick={() => removeCategory(category.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Field>
                  <FieldLabel htmlFor={`${category.id}-group`}>Group</FieldLabel>
                  <Select
                    id={`${category.id}-group`}
                    items={GROUP_OPTIONS}
                    value={category.group}
                    onValueChange={(value) =>
                      updateCategory(category.id, { group: value as OpexCategory['group'] })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${category.id}-basis`}>Basis</FieldLabel>
                  <Select
                    id={`${category.id}-basis`}
                    items={BASIS_OPTIONS}
                    value={category.basis}
                    onValueChange={(value) =>
                      updateCategory(category.id, { basis: value as OpexCategory['basis'] })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${category.id}-amount`}>
                    {category.basis === 'pctOfRevenue' ? 'Percentage' : 'Amount'}
                  </FieldLabel>
                  <Input
                    id={`${category.id}-amount`}
                    type="number"
                    min={0}
                    value={category.amount}
                    onChange={(event) =>
                      updateCategory(category.id, { amount: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${category.id}-escalation`}>Escalation %</FieldLabel>
                  <Input
                    id={`${category.id}-escalation`}
                    type="number"
                    min={0}
                    value={
                      Array.isArray(category.escalationPct) ? (category.escalationPct[0] ?? 0) : category.escalationPct
                    }
                    onChange={(event) =>
                      updateCategory(category.id, { escalationPct: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${category.id}-start`}>Start year</FieldLabel>
                  <Input
                    id={`${category.id}-start`}
                    type="number"
                    min={0}
                    value={category.startYearIndex}
                    onChange={(event) =>
                      updateCategory(category.id, { startYearIndex: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${category.id}-end`}>End year</FieldLabel>
                  <Input
                    id={`${category.id}-end`}
                    type="number"
                    min={0}
                    placeholder="No end"
                    value={category.endYearIndex ?? ''}
                    onChange={(event) =>
                      updateCategory(category.id, {
                        endYearIndex: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
