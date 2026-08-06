'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import { Switch } from '@/components/ui/switch'
import type { Financing } from '@/domain/costs'
import { useProjectStore } from '@/store/project-store'

/**
 * `FinancingSchema` is four scalar fields, not a repeating list — this stays
 * a compact settings form rather than a grid, since the ">3 rows of the
 * same shape" rule for grids doesn't apply to a single settings object.
 */
export function FinancingEditor({ projectId, financing }: { projectId: string; financing: Financing }) {
  const updateFinancing = useProjectStore((state) => state.updateFinancing)
  const patch = (values: Partial<Financing>) => updateFinancing(projectId, values)

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-heading">Financing</h3>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="openingCash">Opening cash</FieldLabel>
          <Input
            id="openingCash"
            type="number"
            value={financing.openingCash}
            onChange={(event) => patch({ openingCash: Number(event.target.value) })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="payablesDays">Payables days</FieldLabel>
          <SliderNumberField
            id="payablesDays"
            aria-label="Payables days"
            min={0}
            max={365}
            step={1}
            suffix="days"
            value={financing.payablesDays}
            onValueChange={(value) => patch({ payablesDays: value })}
          />
          <FieldDescription>Days of credit taken on operating costs.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="corporateTaxPct">Corporate tax %</FieldLabel>
          <SliderNumberField
            id="corporateTaxPct"
            aria-label="Corporate tax %"
            min={0}
            max={100}
            step={0.5}
            suffix="%"
            value={financing.corporateTaxPct}
            onValueChange={(value) => patch({ corporateTaxPct: value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="carryLossesForward">Carry losses forward</FieldLabel>
          <label className="flex h-8 items-center gap-2 text-sm text-foreground">
            <Switch
              id="carryLossesForward"
              checked={financing.carryLossesForward}
              onCheckedChange={(checked) => patch({ carryLossesForward: checked })}
            />
            {financing.carryLossesForward ? 'Yes' : 'No'}
          </label>
          <FieldDescription>Losses carried forward reduce taxable profit in later years.</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}
