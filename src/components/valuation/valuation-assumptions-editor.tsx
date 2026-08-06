'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import { ValuationMethodSchema, type CapitalModel, type Valuation } from '@/domain/capital'
import { useProjectStore } from '@/store/project-store'

const METHOD_LABELS: Record<Valuation['method'], string> = {
  perpetuity: 'Perpetuity growth',
  exitMultiple: 'Exit multiple',
}

const METHOD_OPTIONS = ValuationMethodSchema.options.map((value) => ({
  value,
  label: METHOD_LABELS[value],
}))

export function ValuationAssumptionsEditor({
  projectId,
  capital,
}: {
  projectId: string
  capital: CapitalModel
}) {
  const updateValuation = useProjectStore((state) => state.updateValuation)
  const valuation = capital.valuation
  const patch = (values: Partial<Valuation>) => updateValuation(projectId, values)

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-heading">Valuation assumptions</h3>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="valuation-method">Terminal value method</FieldLabel>
          <Select
            id="valuation-method"
            items={METHOD_OPTIONS}
            value={valuation.method}
            onValueChange={(value) => patch({ method: value as Valuation['method'] })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="discountRatePct">Discount rate %</FieldLabel>
          <SliderNumberField
            id="discountRatePct"
            aria-label="Discount rate %"
            min={0}
            max={50}
            step={0.5}
            suffix="%"
            value={valuation.discountRatePct}
            onValueChange={(value) => patch({ discountRatePct: value })}
          />
        </Field>
        {valuation.method === 'perpetuity' ? (
          <Field>
            <FieldLabel htmlFor="terminalGrowthPct">Terminal growth %</FieldLabel>
            <SliderNumberField
              id="terminalGrowthPct"
              aria-label="Terminal growth %"
              min={-10}
              max={20}
              step={0.5}
              suffix="%"
              value={valuation.terminalGrowthPct}
              onValueChange={(value) => patch({ terminalGrowthPct: value })}
            />
            <FieldDescription>Held below the discount rate — a terminal value needs a discount rate that stays above the growth rate.</FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="exitEbitdaMultiple">Exit EBITDA multiple</FieldLabel>
            <SliderNumberField
              id="exitEbitdaMultiple"
              aria-label="Exit EBITDA multiple"
              min={0}
              max={50}
              step={0.5}
              suffix="x"
              value={valuation.exitEbitdaMultiple}
              onValueChange={(value) => patch({ exitEbitdaMultiple: value })}
            />
          </Field>
        )}
      </CardContent>
    </Card>
  )
}
