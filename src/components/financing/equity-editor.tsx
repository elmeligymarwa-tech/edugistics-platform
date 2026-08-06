'use client'

import { Plus, Trash2 } from 'lucide-react'

import { DataGrid, toNumberOrZero, type GridColumnDef } from '@/components/grid'
import { GlossaryHint } from '@/components/glossary/glossary-hint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import type { CapitalModel, Equity, EquityInjection } from '@/domain/capital'
import { useProjectStore } from '@/store/project-store'

function createInjection(): EquityInjection {
  return {
    id: globalThis.crypto.randomUUID(),
    label: 'New injection',
    amount: 0,
    yearIndex: 0,
  }
}

export function EquityEditor({
  projectId,
  capital,
}: {
  projectId: string
  capital: CapitalModel
}) {
  const updateEquity = useProjectStore((state) => state.updateEquity)
  const updateOpeningFixedAssets = useProjectStore((state) => state.updateOpeningFixedAssets)
  const equity = capital.equity

  const patch = (values: Partial<Equity>) => updateEquity(projectId, values)

  const addInjection = () => patch({ injections: [...equity.injections, createInjection()] })

  const updateInjection = (id: string, values: Partial<EquityInjection>) =>
    patch({
      injections: equity.injections.map((injection) =>
        injection.id === id ? { ...injection, ...values } : injection,
      ),
    })

  const removeInjection = (id: string) =>
    patch({ injections: equity.injections.filter((injection) => injection.id !== id) })

  const columns: GridColumnDef<EquityInjection>[] = [
    {
      id: 'label',
      label: 'Label',
      kind: 'text',
      width: 200,
      minWidth: 160,
      pinned: 'left',
      getValue: (injection) => injection.label,
      onCommit: (injection, value) =>
        updateInjection(injection.id, { label: typeof value === 'string' ? value : '' }),
      render: (injection) => (
        <div className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">{injection.label}</span>
          <button
            type="button"
            aria-label={`Remove ${injection.label}`}
            onClick={() => removeInjection(injection.id)}
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
      width: 140,
      minWidth: 116,
      allowFillDown: true,
      getValue: (injection) => injection.amount,
      onCommit: (injection, value) => updateInjection(injection.id, { amount: toNumberOrZero(value) }),
    },
    {
      id: 'yearIndex',
      label: 'Forecast year',
      kind: 'numeric',
      width: 120,
      minWidth: 108,
      getValue: (injection) => injection.yearIndex + 1,
      onCommit: (injection, value) =>
        updateInjection(injection.id, { yearIndex: Math.max(0, toNumberOrZero(value) - 1) }),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-heading">Equity</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="openingShareCapital" className="flex items-center gap-1">
              Opening share capital
              <GlossaryHint term="share-capital" currentValue={String(equity.openingShareCapital)} />
            </FieldLabel>
            <Input
              id="openingShareCapital"
              type="number"
              value={equity.openingShareCapital}
              onChange={(event) => patch({ openingShareCapital: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="openingFixedAssets">Opening fixed assets</FieldLabel>
            <Input
              id="openingFixedAssets"
              type="number"
              value={capital.openingFixedAssets}
              onChange={(event) => updateOpeningFixedAssets(projectId, Number(event.target.value))}
            />
            <FieldDescription>Fixed assets already on the books before year one.</FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="dividendPayoutPct" className="flex items-center gap-1">
              Dividend payout %
              <GlossaryHint term="dividend-payout" currentValue={`${equity.dividendPayoutPct}%`} />
            </FieldLabel>
            <SliderNumberField
              id="dividendPayoutPct"
              aria-label="Dividend payout %"
              min={0}
              max={100}
              step={1}
              suffix="%"
              value={equity.dividendPayoutPct}
              onValueChange={(value) => patch({ dividendPayoutPct: value })}
            />
            <FieldDescription>Share of net profit paid out once retained earnings turn positive.</FieldDescription>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-heading">Dated injections</h3>
          <Button type="button" size="sm" variant="outline" onClick={addInjection}>
            <Plus data-icon="inline-start" />
            Add injection
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {equity.injections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No equity injections yet.</p>
          ) : (
            <DataGrid
              rows={equity.injections}
              getRowId={(injection) => injection.id}
              columns={columns}
              mode="edit"
              gridId="financing-equity-injections"
              ariaLabel="Equity injections"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
