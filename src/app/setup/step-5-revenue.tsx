'use client'

import { useEffect } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  EnrolmentModelSchema,
  orderedYearGroups,
  type Collections,
  type Discounts,
  type Project,
  type YearGroupId,
} from '@/domain/schema'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'

const ENROLMENT_MODEL_LABELS: Record<string, string> = {
  occupancy: 'Occupancy-driven',
  cohort: 'Cohort progression',
}

export function Step5Revenue({ project }: { project: Project }) {
  const updateRevenueAssumptions = useProjectStore((state) => state.updateRevenueAssumptions)
  const groups = orderedYearGroups(project)
  const a = project.revenueAssumptions
  const termsPerYear = project.calendar.termsPerYear

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

  const setRetention = (group: YearGroupId, value: number) =>
    updateRevenueAssumptions(project.id, { retentionPct: { ...a.retentionPct, [group]: value } })

  const setIntake = (group: YearGroupId, yearIndex: number, value: number) => {
    const existing = a.newIntake[group] ?? []
    const next = [...existing]
    while (next.length <= yearIndex) next.push(0)
    next[yearIndex] = value
    updateRevenueAssumptions(project.id, { newIntake: { ...a.newIntake, [group]: next } })
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
          <Field>
            <FieldLabel htmlFor="enrolmentModel">Enrolment model</FieldLabel>
            <Select
              id="enrolmentModel"
              value={a.enrolmentModel}
              items={EnrolmentModelSchema.options.map((option) => ({
                value: option,
                label: ENROLMENT_MODEL_LABELS[option] ?? option,
              }))}
              onValueChange={(value) =>
                updateRevenueAssumptions(project.id, {
                  enrolmentModel: value as Project['revenueAssumptions']['enrolmentModel'],
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tuitionEscalation">Tuition escalation %</FieldLabel>
            <Input
              id="tuitionEscalation"
              type="number"
              value={typeof a.tuitionEscalationPct === 'number' ? a.tuitionEscalationPct : 0}
              onChange={(event) =>
                updateRevenueAssumptions(project.id, { tuitionEscalationPct: Number(event.target.value) })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="otherEscalation">Other fee escalation %</FieldLabel>
            <Input
              id="otherEscalation"
              type="number"
              value={typeof a.otherFeeEscalationPct === 'number' ? a.otherFeeEscalationPct : 0}
              onChange={(event) =>
                updateRevenueAssumptions(project.id, { otherFeeEscalationPct: Number(event.target.value) })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="avgSiblings">Average siblings / family</FieldLabel>
            <Input
              id="avgSiblings"
              type="number"
              min={1}
              value={a.avgSiblingsPerFamily}
              onChange={(event) =>
                updateRevenueAssumptions(project.id, { avgSiblingsPerFamily: Number(event.target.value) })
              }
            />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm text-foreground sm:col-span-4">
            <Switch
              checked={a.progression}
              onCheckedChange={(checked) => updateRevenueAssumptions(project.id, { progression: checked })}
            />
            Students progress automatically into the next year group
          </label>
        </CardContent>
      </Card>

      {groups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Retention</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-4 lg:grid-cols-7">
            {groups.map((group) => (
              <Field key={group}>
                <FieldLabel htmlFor={`retention-${group}`}>{YEAR_GROUP_LABELS[group]}</FieldLabel>
                <Input
                  id={`retention-${group}`}
                  type="number"
                  min={0}
                  max={100}
                  value={a.retentionPct[group] ?? 100}
                  onChange={(event) => setRetention(group, Number(event.target.value))}
                />
              </Field>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {groups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>New intake per forecast year</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-0">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left font-medium text-muted-foreground">Year group</th>
                  {Array.from({ length: project.calendar.forecastYears }, (_, index) => (
                    <th key={index} className="p-2 text-left font-medium text-muted-foreground">
                      Year {index + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group} className="border-t border-border">
                    <td className="p-2 font-medium text-foreground">{YEAR_GROUP_LABELS[group]}</td>
                    {Array.from({ length: project.calendar.forecastYears }, (_, index) => (
                      <td key={index} className="p-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-24"
                          value={a.newIntake[group]?.[index] ?? 0}
                          onChange={(event) => setIntake(group, index, Number(event.target.value))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Discounts</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-4 pt-0 sm:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="siblingPct">Sibling discount %</FieldLabel>
            <Input
              id="siblingPct"
              type="number"
              min={0}
              max={100}
              value={a.discounts.siblingPct}
              onChange={(event) => patchDiscounts({ siblingPct: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="siblingEligiblePct">Eligible for sibling %</FieldLabel>
            <Input
              id="siblingEligiblePct"
              type="number"
              min={0}
              max={100}
              value={a.discounts.siblingEligiblePct}
              onChange={(event) => patchDiscounts({ siblingEligiblePct: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="staffChildPct">Staff child discount %</FieldLabel>
            <Input
              id="staffChildPct"
              type="number"
              min={0}
              max={100}
              value={a.discounts.staffChildPct}
              onChange={(event) => patchDiscounts({ staffChildPct: Number(event.target.value) })}
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
            <FieldLabel htmlFor="scholarshipPct">Scholarship discount %</FieldLabel>
            <Input
              id="scholarshipPct"
              type="number"
              min={0}
              max={100}
              value={a.discounts.scholarshipPct}
              onChange={(event) => patchDiscounts({ scholarshipPct: Number(event.target.value) })}
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
            <Input
              id="earlyPaymentPct"
              type="number"
              min={0}
              max={100}
              value={a.discounts.earlyPaymentPct}
              onChange={(event) => patchDiscounts({ earlyPaymentPct: Number(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="earlyPaymentTakeUpPct">Early payment take-up %</FieldLabel>
            <Input
              id="earlyPaymentTakeUpPct"
              type="number"
              min={0}
              max={100}
              value={a.discounts.earlyPaymentTakeUpPct}
              onChange={(event) => patchDiscounts({ earlyPaymentTakeUpPct: Number(event.target.value) })}
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
            <div className="flex flex-wrap gap-2">
              {a.collections.termSplit.map((value, index) => (
                <Field key={index} className="w-24">
                  <FieldLabel>Term {index + 1}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(event) => setTermSplit(index, Number(event.target.value))}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="payInFullPct">Pay-in-full uptake %</FieldLabel>
              <Input
                id="payInFullPct"
                type="number"
                min={0}
                max={100}
                value={a.collections.payInFullPct}
                onChange={(event) => patchCollections({ payInFullPct: Number(event.target.value) })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="badDebtPct">Bad debt %</FieldLabel>
              <Input
                id="badDebtPct"
                type="number"
                min={0}
                max={100}
                value={a.collections.badDebtPct}
                onChange={(event) => patchCollections({ badDebtPct: Number(event.target.value) })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dsoDays">Days sales outstanding</FieldLabel>
              <Input
                id="dsoDays"
                type="number"
                min={0}
                max={365}
                value={a.collections.dsoDays}
                onChange={(event) => patchCollections({ dsoDays: Number(event.target.value) })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="taxRatePct">Tax rate %</FieldLabel>
              <Input
                id="taxRatePct"
                type="number"
                min={0}
                max={100}
                value={a.taxRatePct}
                onChange={(event) =>
                  updateRevenueAssumptions(project.id, { taxRatePct: Number(event.target.value) })
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
