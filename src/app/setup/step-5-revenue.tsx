'use client'

import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

import { DataGrid, toNumberOrZero, type GridColumnDef } from '@/components/grid'
import { GlossaryHint } from '@/components/glossary/glossary-hint'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import { orderedYearGroups, type Collections, type Discounts, type Project, type YearGroupId } from '@/domain/schema'
import { computeEnrolment } from '@/engine/revenue'
import { formatNumber } from '@/lib/format'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { useCostModel, useProjectStore } from '@/store/project-store'

export function Step5Revenue({ project }: { project: Project }) {
  const updateRevenueAssumptions = useProjectStore((state) => state.updateRevenueAssumptions)
  const updateInflationPct = useProjectStore((state) => state.updateInflationPct)
  const costModel = useCostModel(project.id)
  const groups = orderedYearGroups(project)
  const a = project.revenueAssumptions
  const termsPerYear = project.calendar.termsPerYear
  const enrolment = computeEnrolment(project)
  const locale = project.meta.locale

  useEffect(() => {
    const current = a.collections.termSplit
    if (current.length !== termsPerYear) {
      const even = Math.round((100 / termsPerYear) * 100) / 100
      const next = Array.from({ length: termsPerYear }, (_, index) =>
        index === termsPerYear - 1 ? Math.round((100 - even * (termsPerYear - 1)) * 100) / 100 : even,
      )
      updateRevenueAssumptions(project.id, { collections: { ...a.collections, termSplit: next } })
    }
    // Re-runs only when the project or the term count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, termsPerYear])

  const patchDiscounts = (patch: Partial<Discounts>) =>
    updateRevenueAssumptions(project.id, { discounts: { ...a.discounts, ...patch } })

  const patchCollections = (patch: Partial<Collections>) =>
    updateRevenueAssumptions(project.id, { collections: { ...a.collections, ...patch } })

  const calculatedStudents = (group: YearGroupId, yearIndex: number) =>
    Math.round(enrolment[yearIndex]?.find((entry) => entry.yearGroup === group)?.students ?? 0)

  const setIntakeOverride = (group: YearGroupId, yearIndex: number, value: number) => {
    const existing = a.intakeOverrides[group] ?? []
    const next = [...existing]
    while (next.length <= yearIndex) next.push(null)
    next[yearIndex] = value
    updateRevenueAssumptions(project.id, { intakeOverrides: { ...a.intakeOverrides, [group]: next } })
  }

  const resetIntakeOverride = (group: YearGroupId, yearIndex: number) => {
    const existing = a.intakeOverrides[group]
    if (!existing || existing[yearIndex] == null) return
    const next = [...existing]
    next[yearIndex] = null
    updateRevenueAssumptions(project.id, { intakeOverrides: { ...a.intakeOverrides, [group]: next } })
  }

  const setTermSplit = (index: number, value: number) => {
    const next = [...a.collections.termSplit]
    next[index] = value
    patchCollections({ termSplit: next })
  }

  const termSplitTotal = a.collections.termSplit.reduce((sum, value) => sum + value, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Enrolment and escalation</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-4">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="intakeGrowthRate">Annual growth rate %</FieldLabel>
            <SliderNumberField
              id="intakeGrowthRate"
              aria-label="Annual growth rate %"
              min={-50}
              max={100}
              step={0.5}
              suffix="%"
              value={a.intakeGrowthRatePct}
              onValueChange={(value) => updateRevenueAssumptions(project.id, { intakeGrowthRatePct: value })}
            />
            <FieldDescription>
              Compounded onto each year group&apos;s prior-year students to project years after year one.
            </FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="tuitionEscalation" className="flex items-center gap-1">
              Tuition escalation %
              <GlossaryHint
                term="escalation"
                currentValue={`${typeof a.tuitionEscalationPct === 'number' ? a.tuitionEscalationPct : 0}%`}
                context="Tuition escalation"
              />
            </FieldLabel>
            <SliderNumberField
              id="tuitionEscalation"
              aria-label="Tuition escalation %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={typeof a.tuitionEscalationPct === 'number' ? a.tuitionEscalationPct : 0}
              onValueChange={(value) => updateRevenueAssumptions(project.id, { tuitionEscalationPct: value })}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="otherEscalation" className="flex items-center gap-1">
              Other fee escalation %
              <GlossaryHint
                term="escalation"
                currentValue={`${typeof a.otherFeeEscalationPct === 'number' ? a.otherFeeEscalationPct : 0}%`}
                context="Other fee escalation"
              />
            </FieldLabel>
            <SliderNumberField
              id="otherEscalation"
              aria-label="Other fee escalation %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={typeof a.otherFeeEscalationPct === 'number' ? a.otherFeeEscalationPct : 0}
              onValueChange={(value) => updateRevenueAssumptions(project.id, { otherFeeEscalationPct: value })}
            />
          </Field>
          {costModel ? (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="inflationPct">Cost inflation %</FieldLabel>
              <SliderNumberField
                id="inflationPct"
                aria-label="Cost inflation %"
                min={-20}
                max={200}
                step={0.5}
                suffix="%"
                value={costModel.inflationPct}
                onValueChange={(value) => updateInflationPct(project.id, value)}
              />
              <FieldDescription>
                Model wide rate that every payroll position and expense category without its own escalation inherits.
              </FieldDescription>
            </Field>
          ) : null}
        </CardContent>
      </Card>

      {groups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Student numbers per forecast year</CardTitle>
            <CardDescription>
              Year 1 comes from the occupancy ramp set in Step 3 Capacity. Later years compound the annual growth
              rate above onto the prior year, unless overridden below — an overridden cell shows a dot and a reset
              button, and only that cell stops following the growth rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <DataGrid
              rows={groups}
              getRowId={(group) => group}
              columns={[
                {
                  id: 'group',
                  label: 'Year group',
                  kind: 'readonly',
                  width: 140,
                  minWidth: 120,
                  pinned: 'left',
                  getValue: (group) => YEAR_GROUP_LABELS[group],
                },
                ...Array.from({ length: project.calendar.forecastYears }, (_, index): GridColumnDef<YearGroupId> => {
                  if (index === 0) {
                    return {
                      id: 'students-0',
                      label: 'Year 1',
                      kind: 'readonly',
                      width: 104,
                      minWidth: 92,
                      getValue: (group) => calculatedStudents(group, 0),
                      format: (value) => (typeof value === 'number' ? formatNumber(value, locale) : ''),
                    }
                  }
                  return {
                    id: `students-${index}`,
                    label: `Year ${index + 1}`,
                    kind: 'numeric',
                    width: 104,
                    minWidth: 92,
                    allowFillDown: true,
                    allowUplift: true,
                    getValue: (group) => a.intakeOverrides[group]?.[index] ?? calculatedStudents(group, index),
                    onCommit: (group, value) => setIntakeOverride(group, index, toNumberOrZero(value)),
                    format: (value) => (typeof value === 'number' ? formatNumber(value, locale) : ''),
                    render: (group) => {
                      const override = a.intakeOverrides[group]?.[index] ?? null
                      const displayValue = override ?? calculatedStudents(group, index)
                      return (
                        <div className="flex w-full items-center justify-end gap-1">
                          {override !== null ? (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-primary"
                              aria-hidden="true"
                              title="Overridden"
                            />
                          ) : null}
                          <span className="truncate tabular-nums">{formatNumber(displayValue, locale)}</span>
                          {override !== null ? (
                            <button
                              type="button"
                              aria-label={`Reset ${YEAR_GROUP_LABELS[group]} year ${index + 1} to calculated`}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={() => resetIntakeOverride(group, index)}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="size-3" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      )
                    },
                  }
                }),
              ]}
              mode="edit"
              gridId="wizard-step5-students"
              ariaLabel="Student numbers per forecast year"
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Discounts</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-4 gap-y-4 pt-0 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="staffChildPct">Staff child discount %</FieldLabel>
            <SliderNumberField
              id="staffChildPct"
              aria-label="Staff child discount %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={a.discounts.staffChildPct}
              onValueChange={(value) => patchDiscounts({ staffChildPct: value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="staffChildPlaces">Staff child places</FieldLabel>
            <Input
              id="staffChildPlaces"
              type="number"
              min={0}
              value={a.discounts.staffChildPlaces}
              onChange={(event) => patchDiscounts({ staffChildPlaces: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="scholarshipPct" className="flex items-center gap-1">
              Scholarship discount %
              <GlossaryHint term="scholarship" currentValue={`${a.discounts.scholarshipPct}%`} />
            </FieldLabel>
            <SliderNumberField
              id="scholarshipPct"
              aria-label="Scholarship discount %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={a.discounts.scholarshipPct}
              onValueChange={(value) => patchDiscounts({ scholarshipPct: value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="scholarshipPlaces">Scholarship places</FieldLabel>
            <Input
              id="scholarshipPlaces"
              type="number"
              min={0}
              value={a.discounts.scholarshipPlaces}
              onChange={(event) => patchDiscounts({ scholarshipPlaces: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="earlyPaymentPct">Early payment discount %</FieldLabel>
            <SliderNumberField
              id="earlyPaymentPct"
              aria-label="Early payment discount %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={a.discounts.earlyPaymentPct}
              onValueChange={(value) => patchDiscounts({ earlyPaymentPct: value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="earlyPaymentTakeUpPct">Early payment take-up %</FieldLabel>
            <SliderNumberField
              id="earlyPaymentTakeUpPct"
              aria-label="Early payment take-up %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={a.discounts.earlyPaymentTakeUpPct}
              onValueChange={(value) => patchDiscounts({ earlyPaymentTakeUpPct: value })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collections and tax</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Term split (must total 100%, currently {termSplitTotal.toFixed(1)}%)
            </p>
            <div className="flex flex-wrap gap-4">
              {a.collections.termSplit.map((value, index) => (
                <Field key={index} className="w-56">
                  <FieldLabel htmlFor={`term-split-${index}`}>Term {index + 1}</FieldLabel>
                  <SliderNumberField
                    id={`term-split-${index}`}
                    aria-label={`Term ${index + 1} share %`}
                    min={0}
                    max={100}
                    step={0.5}
                    suffix="%"
                    value={value}
                    onValueChange={(next) => setTermSplit(index, next)}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payInFullPct">Pay-in-full uptake %</FieldLabel>
              <SliderNumberField
                id="payInFullPct"
                aria-label="Pay-in-full uptake %"
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                value={a.collections.payInFullPct}
                onValueChange={(value) => patchCollections({ payInFullPct: value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="badDebtPct" className="flex items-center gap-1">
                Bad debt %
                <GlossaryHint term="bad-debt" currentValue={`${a.collections.badDebtPct}%`} />
              </FieldLabel>
              <SliderNumberField
                id="badDebtPct"
                aria-label="Bad debt %"
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                value={a.collections.badDebtPct}
                onValueChange={(value) => patchCollections({ badDebtPct: value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dsoDays" className="flex items-center gap-1">
                Days sales outstanding
                <GlossaryHint term="days-sales-outstanding" currentValue={`${a.collections.dsoDays} days`} />
              </FieldLabel>
              <SliderNumberField
                id="dsoDays"
                aria-label="Days sales outstanding"
                min={0}
                max={365}
                step={1}
                suffix="days"
                value={a.collections.dsoDays}
                onValueChange={(value) => patchCollections({ dsoDays: value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="taxRatePct">Tax rate %</FieldLabel>
              <SliderNumberField
                id="taxRatePct"
                aria-label="Tax rate %"
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                value={a.taxRatePct}
                onValueChange={(value) => updateRevenueAssumptions(project.id, { taxRatePct: value })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
