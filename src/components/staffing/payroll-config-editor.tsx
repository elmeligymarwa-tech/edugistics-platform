'use client'

import { COLUMN_WIDTH, DataGrid, toNumberOrZero, type GridColumnDef, type GridRowGroup } from '@/components/grid'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import { Switch } from '@/components/ui/switch'
import type { PayrollConfig } from '@/domain/costs'
import { StaffSectionSchema, type Project, type StaffPosition } from '@/domain/schema'
import { STAFF_SECTION_LABELS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'

interface HeadcountRow {
  position: StaffPosition
}

/**
 * The aggregate payroll settings (`PayrollConfig`) — default escalation,
 * turnover, recruitment charging — plus the one genuinely repeating field it
 * holds, `headcountByYear`: an explicit headcount override per position per
 * forecast year, overriding both the static headcount and any
 * capacity-derived figure where set.
 */
export function PayrollConfigEditor({
  project,
  payroll,
}: {
  project: Project
  payroll: PayrollConfig
}) {
  const updatePayrollConfig = useProjectStore((state) => state.updatePayrollConfig)
  const patch = (values: Partial<PayrollConfig>) => updatePayrollConfig(project.id, values)

  const defaultIncrementPct = typeof payroll.defaultIncrementPct === 'number' ? payroll.defaultIncrementPct : (payroll.defaultIncrementPct[0] ?? 0)
  const forecastYears = project.calendar.forecastYears

  const rowGroups: GridRowGroup<HeadcountRow>[] = StaffSectionSchema.options
    .map((section): GridRowGroup<HeadcountRow> | null => {
      const positions = project.staffing.positions.filter((position) => position.section === section)
      if (positions.length === 0) return null
      return {
        id: section,
        label: STAFF_SECTION_LABELS[section] ?? section,
        rows: positions.map((position) => ({ position })),
      }
    })
    .filter((group): group is GridRowGroup<HeadcountRow> => group !== null)

  const columns: GridColumnDef<HeadcountRow>[] = [
    {
      id: 'title',
      label: 'Position',
      kind: 'readonly',
      ...COLUMN_WIDTH.label,
      pinned: 'left',
      getValue: (row) => row.position.title,
    },
    ...Array.from({ length: forecastYears }, (_, yearIndex): GridColumnDef<HeadcountRow> => ({
      id: `headcount-${yearIndex}`,
      label: `Year ${yearIndex + 1}`,
      kind: 'numeric',
      ...COLUMN_WIDTH.count,
      allowFillDown: true,
      getValue: (row) => payroll.headcountByYear[row.position.id]?.[yearIndex] ?? row.position.headcount,
      onCommit: (row, value) => {
        const current = payroll.headcountByYear[row.position.id] ?? []
        const next = [...current]
        while (next.length <= yearIndex) next.push(row.position.headcount)
        next[yearIndex] = toNumberOrZero(value)
        patch({ headcountByYear: { ...payroll.headcountByYear, [row.position.id]: next } })
      },
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-heading">Payroll settings</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-0 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="defaultIncrementPct">Default annual increment %</FieldLabel>
            <SliderNumberField
              id="defaultIncrementPct"
              aria-label="Default annual increment %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={defaultIncrementPct}
              onValueChange={(value) => patch({ defaultIncrementPct: value })}
            />
            <FieldDescription>Fallback escalation for a position with no increment of its own.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="turnoverPct">Annual staff turnover %</FieldLabel>
            <SliderNumberField
              id="turnoverPct"
              aria-label="Annual staff turnover %"
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              value={payroll.turnoverPct}
              onValueChange={(value) => patch({ turnoverPct: value })}
            />
            <FieldDescription>Creates replacement recruitment cost.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="chargeRecruitmentOnNewHiresOnly">Recruitment cost basis</FieldLabel>
            <label className="flex h-8 items-center gap-2 text-sm text-foreground">
              <Switch
                id="chargeRecruitmentOnNewHiresOnly"
                checked={payroll.chargeRecruitmentOnNewHiresOnly}
                onCheckedChange={(checked) => patch({ chargeRecruitmentOnNewHiresOnly: checked })}
              />
              {payroll.chargeRecruitmentOnNewHiresOnly ? 'New hires only' : 'Whole team'}
            </label>
          </Field>
        </CardContent>
      </Card>

      {rowGroups.length > 0 ? (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-heading">Headcount by year</h3>
          </CardHeader>
          <CardContent className="pt-0">
            <DataGrid
              rows={rowGroups}
              getRowId={(row) => row.position.id}
              columns={columns}
              mode="edit"
              gridId="staffing-payroll-headcount"
              ariaLabel="Headcount by forecast year"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
