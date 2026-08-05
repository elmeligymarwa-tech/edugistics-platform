'use client'

import { Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { StaffPosition } from '@/domain/schema'

export const NUMBER_FIELDS: Array<{ key: keyof StaffPosition; label: string }> = [
  { key: 'averageSalary', label: 'Average salary' },
  { key: 'minimumSalary', label: 'Minimum salary' },
  { key: 'maximumSalary', label: 'Maximum salary' },
  { key: 'annualIncrementPct', label: 'Annual increment %' },
  { key: 'employerTaxPct', label: 'Employer tax %' },
  { key: 'nationalInsurancePct', label: 'National insurance %' },
  { key: 'medicalInsurancePct', label: 'Medical insurance %' },
  { key: 'pensionPct', label: 'Pension %' },
  { key: 'housingAllowance', label: 'Housing allowance' },
  { key: 'transportAllowance', label: 'Transport allowance' },
  { key: 'recruitmentCost', label: 'Recruitment cost' },
  { key: 'trainingCost', label: 'Training cost' },
]

export function PositionCard({
  position,
  onUpdate,
  onRemove,
}: {
  position: StaffPosition
  onUpdate: (patch: Partial<StaffPosition>) => void
  onRemove: () => void
}) {
  const isDerivedLocked = position.derivedFromCapacity && !position.manualOverride

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            className="h-7 w-48"
            value={position.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
          {position.derivedFromCapacity && position.manualOverride ? (
            <Badge variant="warning">Overridden</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {position.derivedFromCapacity ? (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch
                checked={position.manualOverride}
                onCheckedChange={(checked) => onUpdate({ manualOverride: checked })}
              />
              Override headcount
            </label>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${position.title}`}
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-4 lg:grid-cols-6">
        <Field>
          <FieldLabel htmlFor={`${position.id}-headcount`}>Headcount</FieldLabel>
          <Input
            id={`${position.id}-headcount`}
            type="number"
            min={0}
            disabled={isDerivedLocked}
            value={position.headcount}
            onChange={(event) => onUpdate({ headcount: Number(event.target.value) })}
          />
        </Field>
        {NUMBER_FIELDS.map((field) => (
          <Field key={field.key}>
            <FieldLabel htmlFor={`${position.id}-${field.key}`}>{field.label}</FieldLabel>
            <Input
              id={`${position.id}-${field.key}`}
              type="number"
              min={0}
              value={position[field.key] as number}
              onChange={(event) =>
                onUpdate({ [field.key]: Number(event.target.value) } as Partial<StaffPosition>)
              }
            />
          </Field>
        ))}
      </CardContent>
    </Card>
  )
}
