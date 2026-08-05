'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { Project, StmAgreement } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatMoney, formatPercent } from '@/lib/format'
import { useProjectStore } from '@/store/project-store'

type StmTier = StmAgreement['tiers'][number]

const BASIS_OPTIONS: { value: StmAgreement['basis']; label: string }[] = [
  { value: 'grossRevenue', label: 'Gross revenue' },
  { value: 'netRevenue', label: 'Net revenue' },
  { value: 'collectedCash', label: 'Collected cash' },
]

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'termly', label: 'Termly' },
  { value: 'annual', label: 'Annual' },
]

function createTier(previous: StmTier | undefined): StmTier {
  return {
    thresholdFrom: previous ? previous.thresholdFrom + 100_000 : 0,
    ratePct: previous?.ratePct ?? 0,
  }
}

export function StmAgreementEditor({
  project,
  stm,
  forecast,
}: {
  project: Project
  stm: StmAgreement
  forecast: Forecast
}) {
  const updateStm = useProjectStore((state) => state.updateStm)
  const removeStm = () => updateStm(project.id, null)
  const patch = (next: Partial<StmAgreement>) => updateStm(project.id, { ...stm, ...next })

  const yearOptions = forecast.years.map((year) => ({ value: String(year.yearIndex), label: year.label }))
  const endYearOptions = [{ value: 'ongoing', label: 'Ongoing' }, ...yearOptions]

  const updateTier = (index: number, next: Partial<StmTier>) =>
    patch({ tiers: stm.tiers.map((tier, i) => (i === index ? { ...tier, ...next } : tier)) })

  const removeTier = (index: number) =>
    patch({ tiers: stm.tiers.filter((_, i) => i !== index) })

  const addTier = () => patch({ tiers: [...stm.tiers, createTier(stm.tiers[stm.tiers.length - 1])] })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Agreement terms</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={removeStm}>
          <Trash2 data-icon="inline-start" />
          Remove agreement
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-0">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="stm-counterparty">Counterparty name</FieldLabel>
            <Input
              id="stm-counterparty"
              value={stm.counterpartyName}
              onChange={(event) => patch({ counterpartyName: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="stm-basis">Basis</FieldLabel>
            <Select
              id="stm-basis"
              items={BASIS_OPTIONS}
              value={stm.basis}
              onValueChange={(value) => patch({ basis: value as StmAgreement['basis'] })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="stm-frequency">Payment frequency</FieldLabel>
            <Select
              id="stm-frequency"
              items={FREQUENCY_OPTIONS}
              value={stm.paymentFrequency}
              onValueChange={(value) => patch({ paymentFrequency: value as StmAgreement['paymentFrequency'] })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="stm-start-year">Start year</FieldLabel>
            <Select
              id="stm-start-year"
              items={yearOptions}
              value={String(stm.startYearIndex)}
              onValueChange={(value) => patch({ startYearIndex: Number(value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="stm-end-year">End year</FieldLabel>
            <Select
              id="stm-end-year"
              items={endYearOptions}
              value={stm.endYearIndex === null ? 'ongoing' : String(stm.endYearIndex)}
              onValueChange={(value) => patch({ endYearIndex: value === 'ongoing' ? null : Number(value) })}
            />
          </Field>
        </div>

        <Field>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="stm-rate">Rate</FieldLabel>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatPercent(stm.ratePct, 1)}
            </span>
          </div>
          <Slider
            id="stm-rate"
            min={0}
            max={50}
            step={0.5}
            value={stm.ratePct}
            onValueChange={(value) => patch({ ratePct: value })}
          />
          {stm.tiers.length > 0 ? (
            <FieldDescription>Tiered bands are set below and take precedence over this flat rate.</FieldDescription>
          ) : null}
        </Field>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">Tiered bands (optional)</p>
            <Button type="button" size="sm" variant="outline" onClick={addTier}>
              <Plus data-icon="inline-start" />
              Add band
            </Button>
          </div>
          {stm.tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tiered bands. The flat rate above applies to the whole base.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {stm.tiers.map((tier, index) => (
                <div key={index} className="flex items-end gap-2 rounded-lg border border-border p-2">
                  <Field className="flex-1">
                    <FieldLabel htmlFor={`stm-tier-${index}-from`}>From</FieldLabel>
                    <Input
                      id={`stm-tier-${index}-from`}
                      type="number"
                      min={0}
                      value={tier.thresholdFrom}
                      onChange={(event) => updateTier(index, { thresholdFrom: Number(event.target.value) })}
                    />
                  </Field>
                  <Field className="flex-1">
                    <FieldLabel htmlFor={`stm-tier-${index}-rate`}>Rate %</FieldLabel>
                    <Input
                      id={`stm-tier-${index}-rate`}
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={tier.ratePct}
                      onChange={(event) => updateTier(index, { ratePct: Number(event.target.value) })}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove band starting at ${formatMoney(tier.thresholdFrom, project.meta)}`}
                    onClick={() => removeTier(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="stm-min-guarantee-toggle">Minimum guarantee</FieldLabel>
            <Switch
              id="stm-min-guarantee-toggle"
              checked={stm.minimumGuarantee !== null}
              onCheckedChange={(checked) => patch({ minimumGuarantee: checked ? 0 : null })}
            />
          </div>
          {stm.minimumGuarantee !== null ? (
            <Input
              type="number"
              min={0}
              aria-label="Minimum guarantee amount"
              value={stm.minimumGuarantee}
              onChange={(event) => patch({ minimumGuarantee: Number(event.target.value) })}
            />
          ) : (
            <FieldDescription>No floor. The computed liability can fall to zero.</FieldDescription>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
