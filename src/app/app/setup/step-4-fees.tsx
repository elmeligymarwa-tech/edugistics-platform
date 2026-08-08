'use client'

import { Plus, Trash2 } from 'lucide-react'

import { COLUMN_WIDTH, DataGrid, toNumberOrZero, type GridColumnDef, type GridColumnGroup } from '@/components/grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  oneOffOnEntry: 'One-off on entry',
}
const ESCALATION_GROUP_LABELS: Record<string, string> = { tuition: 'Tuition', other: 'Other' }
const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

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

  const categoryColumns: GridColumnDef<FeeCategory>[] = [
    {
      id: 'name',
      label: 'Name',
      kind: 'text',
      ...COLUMN_WIDTH.label,
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
      id: 'taxTreatment',
      label: 'Tax treatment',
      kind: 'select',
      ...COLUMN_WIDTH.select,
      selectOptions: TaxTreatmentSchema.options.map((option) => ({ value: option, label: TAX_TREATMENT_LABELS[option] ?? option })),
      getValue: (category) => category.taxTreatment,
      onCommit: (category, value) =>
        updateCategory(category.id, { taxTreatment: value as FeeCategory['taxTreatment'] }),
    },
    {
      id: 'billingFrequency',
      label: 'Billing',
      kind: 'select',
      ...COLUMN_WIDTH.select,
      selectOptions: BillingFrequencySchema.options.map((option) => ({
        value: option,
        label: BILLING_FREQUENCY_LABELS[option] ?? option,
      })),
      getValue: (category) => category.billingFrequency,
      onCommit: (category, value) =>
        updateCategory(category.id, { billingFrequency: value as FeeCategory['billingFrequency'] }),
    },
    {
      id: 'chargeBasis',
      label: 'Charge basis',
      kind: 'select',
      ...COLUMN_WIDTH.select,
      selectOptions: ChargeBasisSchema.options.map((option) => ({ value: option, label: CHARGE_BASIS_LABELS[option] ?? option })),
      getValue: (category) => category.chargeBasis,
      onCommit: (category, value) => updateCategory(category.id, { chargeBasis: value as FeeCategory['chargeBasis'] }),
    },
    {
      id: 'escalationGroup',
      label: 'Escalation group',
      kind: 'select',
      ...COLUMN_WIDTH.select,
      selectOptions: EscalationGroupSchema.options.map((option) => ({
        value: option,
        label: ESCALATION_GROUP_LABELS[option] ?? option,
      })),
      getValue: (category) => category.escalationGroup,
      onCommit: (category, value) =>
        updateCategory(category.id, { escalationGroup: value as FeeCategory['escalationGroup'] }),
    },
    {
      id: 'uptakePct',
      label: 'Uptake %',
      kind: 'percent',
      ...COLUMN_WIDTH.percent,
      disabled: (category) => category.mandatory,
      getValue: (category) => category.uptakePct,
      onCommit: (category, value) => updateCategory(category.id, { uptakePct: toNumberOrZero(value) }),
    },
    {
      id: 'mandatory',
      label: 'Mandatory',
      kind: 'select',
      ...COLUMN_WIDTH.select,
      selectOptions: YES_NO_OPTIONS,
      getValue: (category) => String(category.mandatory),
      onCommit: (category, value) => updateCategory(category.id, { mandatory: value === 'true' }),
    },
    {
      id: 'discountable',
      label: 'Discountable',
      kind: 'select',
      ...COLUMN_WIDTH.select,
      selectOptions: YES_NO_OPTIONS,
      getValue: (category) => String(category.discountable),
      onCommit: (category, value) => updateCategory(category.id, { discountable: value === 'true' }),
    },
    {
      id: 'includedInStm',
      label: 'Included in STM',
      kind: 'select',
      ...COLUMN_WIDTH.select,
      selectOptions: YES_NO_OPTIONS,
      getValue: (category) => String(category.includedInStm),
      onCommit: (category, value) => updateCategory(category.id, { includedInStm: value === 'true' }),
    },
  ]

  const amountColumns: (GridColumnDef<YearGroupId> | GridColumnGroup<YearGroupId>)[] = [
    {
      id: 'group',
      label: 'Year group',
      kind: 'readonly',
      ...COLUMN_WIDTH.shortLabel,
      pinned: 'left',
      getValue: (group) => YEAR_GROUP_LABELS[group],
    },
    ...EscalationGroupSchema.options
      .map((escalationGroup): GridColumnGroup<YearGroupId> | null => {
        const categoriesInGroup = project.fees.categories.filter((category) => category.escalationGroup === escalationGroup)
        if (categoriesInGroup.length === 0) return null
        return {
          id: `escalation-${escalationGroup}`,
          label: ESCALATION_GROUP_LABELS[escalationGroup] ?? escalationGroup,
          collapsible: true,
          defaultCollapsed: false,
          columns: categoriesInGroup.map(
            (category): GridColumnDef<YearGroupId> => ({
              id: category.id,
              label: category.mandatory ? category.name : `${category.name} (optional)`,
              kind: 'numeric',
              ...COLUMN_WIDTH.money,
              allowFillDown: true,
              allowUplift: true,
              getValue: (group) => project.fees.amounts[group]?.[category.id] ?? 0,
              onCommit: (group, value) => setAmount(group, category.id, toNumberOrZero(value)),
            }),
          ),
        }
      })
      .filter((group): group is GridColumnGroup<YearGroupId> => group !== null),
  ]

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
            <DataGrid
              rows={project.fees.categories}
              getRowId={(category) => category.id}
              columns={categoryColumns}
              mode="edit"
              gridId="wizard-step4-categories"
              ariaLabel="Fee categories"
            />
          )}
        </CardContent>
      </Card>

      {groups.length === 0 || project.fees.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select year groups and add at least one fee category to enter amounts.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Fee amounts</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DataGrid
              rows={groups}
              getRowId={(group) => group}
              columns={amountColumns}
              mode="edit"
              gridId="wizard-step4-amounts"
              ariaLabel="Fee amounts"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
