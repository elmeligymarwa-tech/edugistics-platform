'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  BillingFrequencySchema,
  ChargeBasisSchema,
  EscalationGroupSchema,
  TaxTreatmentSchema,
  orderedYearGroups,
  type FeeCategory,
  type FeeStructure,
  type Project,
  type YearGroupId,
} from '@/domain/schema'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'

const TAX_TREATMENT_LABELS: Record<string, string> = {
  exclusive: 'Exclusive of tax',
  inclusive: 'Inclusive of tax',
  exempt: 'Exempt',
}
const BILLING_FREQUENCY_LABELS: Record<string, string> = {
  annual: 'Annual',
  termly: 'Termly',
  monthly: 'Monthly',
}
const CHARGE_BASIS_LABELS: Record<string, string> = {
  perStudent: 'Per student',
  perFamily: 'Per family',
  oneOffOnEntry: 'One-off on entry',
}
const ESCALATION_GROUP_LABELS: Record<string, string> = { tuition: 'Tuition', other: 'Other' }

function createFeeCategory(name: string): FeeCategory {
  return {
    id: globalThis.crypto.randomUUID(),
    name,
    mandatory: true,
    uptakePct: 100,
    includedInStm: false,
    discountable: false,
    taxTreatment: 'exempt',
    billingFrequency: 'annual',
    chargeBasis: 'perStudent',
    escalationGroup: 'other',
  }
}

export function Step4Fees({ project }: { project: Project }) {
  const updateFees = useProjectStore((state) => state.updateFees)
  const groups = orderedYearGroups(project)
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [upliftCategory, setUpliftCategory] = useState<string>('all')
  const [upliftPct, setUpliftPct] = useState(0)

  const addCategory = () => {
    updateFees(project.id, { categories: [...project.fees.categories, createFeeCategory('New category')] })
  }

  const updateCategory = (id: string, patch: Partial<FeeCategory>) => {
    updateFees(project.id, {
      categories: project.fees.categories.map((category) =>
        category.id === id ? { ...category, ...patch } : category,
      ),
    })
  }

  const removeCategory = (id: string) => {
    const amounts: FeeStructure['amounts'] = {}
    for (const [group, byCategory] of Object.entries(project.fees.amounts)) {
      const rest = { ...byCategory }
      delete rest[id]
      amounts[group] = rest
    }
    updateFees(project.id, {
      categories: project.fees.categories.filter((category) => category.id !== id),
      amounts,
    })
  }

  const setAmount = (group: YearGroupId, categoryId: string, amount: number) => {
    updateFees(project.id, {
      amounts: {
        ...project.fees.amounts,
        [group]: { ...project.fees.amounts[group], [categoryId]: amount },
      },
    })
  }

  const applyUplift = () => {
    if (upliftPct === 0) return
    const targetIds =
      upliftCategory === 'all' ? project.fees.categories.map((category) => category.id) : [upliftCategory]
    const amounts: FeeStructure['amounts'] = {}
    for (const group of groups) {
      const current = { ...(project.fees.amounts[group] ?? {}) }
      for (const id of targetIds) {
        const base = current[id] ?? 0
        if (base > 0) current[id] = base * (1 + upliftPct / 100)
      }
      amounts[group] = current
    }
    updateFees(project.id, { amounts: { ...project.fees.amounts, ...amounts } })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Fee categories</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addCategory}>
            <Plus data-icon="inline-start" />
            Add category
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {project.fees.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fee categories yet. Add one to get started.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {project.fees.categories.map((category) => (
                <div key={category.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field className="min-w-40 flex-1">
                      <FieldLabel htmlFor={`${category.id}-name`}>Name</FieldLabel>
                      <Input
                        id={`${category.id}-name`}
                        value={category.name}
                        onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                      />
                    </Field>

                    <Field className="w-40">
                      <FieldLabel htmlFor={`${category.id}-tax`}>Tax treatment</FieldLabel>
                      <Select
                        id={`${category.id}-tax`}
                        value={category.taxTreatment}
                        items={TaxTreatmentSchema.options.map((option) => ({
                          value: option,
                          label: TAX_TREATMENT_LABELS[option] ?? option,
                        }))}
                        onValueChange={(value) =>
                          updateCategory(category.id, {
                            taxTreatment: value as FeeCategory['taxTreatment'],
                          })
                        }
                      />
                    </Field>

                    <Field className="w-36">
                      <FieldLabel htmlFor={`${category.id}-billing`}>Billing</FieldLabel>
                      <Select
                        id={`${category.id}-billing`}
                        value={category.billingFrequency}
                        items={BillingFrequencySchema.options.map((option) => ({
                          value: option,
                          label: BILLING_FREQUENCY_LABELS[option] ?? option,
                        }))}
                        onValueChange={(value) =>
                          updateCategory(category.id, {
                            billingFrequency: value as FeeCategory['billingFrequency'],
                          })
                        }
                      />
                    </Field>

                    <Field className="w-40">
                      <FieldLabel htmlFor={`${category.id}-basis`}>Charge basis</FieldLabel>
                      <Select
                        id={`${category.id}-basis`}
                        value={category.chargeBasis}
                        items={ChargeBasisSchema.options.map((option) => ({
                          value: option,
                          label: CHARGE_BASIS_LABELS[option] ?? option,
                        }))}
                        onValueChange={(value) =>
                          updateCategory(category.id, { chargeBasis: value as FeeCategory['chargeBasis'] })
                        }
                      />
                    </Field>

                    <Field className="w-32">
                      <FieldLabel htmlFor={`${category.id}-escalation`}>Escalation group</FieldLabel>
                      <Select
                        id={`${category.id}-escalation`}
                        value={category.escalationGroup}
                        items={EscalationGroupSchema.options.map((option) => ({
                          value: option,
                          label: ESCALATION_GROUP_LABELS[option] ?? option,
                        }))}
                        onValueChange={(value) =>
                          updateCategory(category.id, {
                            escalationGroup: value as FeeCategory['escalationGroup'],
                          })
                        }
                      />
                    </Field>

                    <Field className="w-24">
                      <FieldLabel htmlFor={`${category.id}-uptake`}>Uptake %</FieldLabel>
                      <Input
                        id={`${category.id}-uptake`}
                        type="number"
                        min={0}
                        max={100}
                        disabled={category.mandatory}
                        value={category.uptakePct}
                        onChange={(event) =>
                          updateCategory(category.id, { uptakePct: Number(event.target.value) })
                        }
                      />
                    </Field>

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

                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Switch
                        checked={category.mandatory}
                        onCheckedChange={(checked) => updateCategory(category.id, { mandatory: checked })}
                      />
                      Mandatory
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Switch
                        checked={category.discountable}
                        onCheckedChange={(checked) => updateCategory(category.id, { discountable: checked })}
                      />
                      Discountable
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Switch
                        checked={category.includedInStm}
                        onCheckedChange={(checked) => updateCategory(category.id, { includedInStm: checked })}
                      />
                      Included in STM
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {project.fees.categories.length > 0 && groups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Bulk actions</CardTitle>
          </CardHeader>
          <CardContent className="flex-row flex-wrap items-end gap-3 pt-0">
            <Field className="w-56">
              <FieldLabel htmlFor="upliftCategory">Category</FieldLabel>
              <Select
                id="upliftCategory"
                value={upliftCategory}
                items={[
                  { value: 'all', label: 'All categories' },
                  ...project.fees.categories.map((category) => ({ value: category.id, label: category.name })),
                ]}
                onValueChange={setUpliftCategory}
              />
            </Field>
            <Field className="w-32">
              <FieldLabel htmlFor="upliftPct">Uplift %</FieldLabel>
              <Input
                id="upliftPct"
                type="number"
                value={upliftPct}
                onChange={(event) => setUpliftPct(Number(event.target.value))}
              />
            </Field>
            <Button type="button" onClick={applyUplift}>
              Apply uplift
            </Button>

            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={view === 'cards' ? 'default' : 'outline'}
                onClick={() => setView('cards')}
              >
                Cards
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === 'table' ? 'default' : 'outline'}
                onClick={() => setView('table')}
              >
                Bulk edit table
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {groups.length === 0 || project.fees.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select year groups and add at least one fee category to enter amounts.
        </p>
      ) : view === 'table' ? (
        <Card>
          <CardContent className="max-h-[32rem] overflow-auto pt-4">
            <table className="data-table w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">
                    Category
                  </th>
                  {groups.map((group) => (
                    <th key={group} className="p-2 text-left font-medium text-muted-foreground">
                      {YEAR_GROUP_LABELS[group]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.fees.categories.map((category) => (
                  <tr key={category.id} className="border-t border-border">
                    <td className="sticky left-0 bg-card p-2 font-medium text-foreground">{category.name}</td>
                    {groups.map((group) => (
                      <td key={group} className="p-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-28"
                          value={project.fees.amounts[group]?.[category.id] ?? 0}
                          onChange={(event) => setAmount(group, category.id, Number(event.target.value))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle>{YEAR_GROUP_LABELS[group]}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-3 lg:grid-cols-4">
                {project.fees.categories.map((category) => (
                  <Field key={category.id}>
                    <FieldLabel htmlFor={`${group}-${category.id}`}>
                      {category.name}
                      {category.mandatory ? null : <Badge className="ml-1.5">optional</Badge>}
                    </FieldLabel>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{project.meta.currencySymbol}</span>
                      <Input
                        id={`${group}-${category.id}`}
                        type="number"
                        min={0}
                        value={project.fees.amounts[group]?.[category.id] ?? 0}
                        onChange={(event) => setAmount(group, category.id, Number(event.target.value))}
                      />
                    </div>
                  </Field>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
