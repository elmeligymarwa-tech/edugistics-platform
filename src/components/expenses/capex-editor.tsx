'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { CapexItem } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatMoney } from '@/lib/format'
import { useProjectStore } from '@/store/project-store'

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

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Capital expenditure</h3>
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus data-icon="inline-start" />
          Add item
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {capex.length === 0 ? (
          <p className="text-sm text-muted-foreground">No capital expenditure items yet.</p>
        ) : (
          capex.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Input
                  className="h-7 w-56"
                  value={item.name}
                  onChange={(event) => updateItem(item.id, { name: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor={`${item.id}-amount`}>Amount</FieldLabel>
                  <Input
                    id={`${item.id}-amount`}
                    type="number"
                    min={0}
                    value={item.amount}
                    onChange={(event) => updateItem(item.id, { amount: Number(event.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${item.id}-year`}>Forecast year</FieldLabel>
                  <Input
                    id={`${item.id}-year`}
                    type="number"
                    min={0}
                    value={item.yearIndex}
                    onChange={(event) => updateItem(item.id, { yearIndex: Number(event.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${item.id}-life`}>Useful life (years)</FieldLabel>
                  <Input
                    id={`${item.id}-life`}
                    type="number"
                    min={1}
                    value={item.usefulLifeYears}
                    onChange={(event) =>
                      updateItem(item.id, { usefulLifeYears: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>
            </div>
          ))
        )}
      </CardContent>
      {capex.length > 0 ? (
        <CardContent className="overflow-x-auto pt-0">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">
                  Depreciation schedule
                </th>
                {costForecast.years.map((year) => (
                  <th key={year.yearIndex} className="p-2 text-right font-medium text-muted-foreground">
                    {year.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="sticky left-0 bg-card p-2 text-foreground">Straight line depreciation</td>
                {costForecast.years.map((year) => (
                  <td key={year.yearIndex} className="p-2 text-right tabular-nums text-foreground">
                    {formatMoney(year.depreciation, project.meta)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      ) : null}
    </Card>
  )
}
