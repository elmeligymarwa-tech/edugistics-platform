'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import type { Forecast } from '@/engine/revenue'

export interface ScenarioOption {
  id: string
  name: string
}

export function DashboardControls({
  forecast,
  yearIndex,
  onYearIndexChange,
  comparisonSelection,
  onComparisonSelectionChange,
  scenarios,
}: {
  forecast: Forecast
  yearIndex: number
  onYearIndexChange: (index: number) => void
  comparisonSelection: string
  onComparisonSelectionChange: (value: string) => void
  scenarios: ScenarioOption[]
}) {
  const yearItems = forecast.years.map((year) => ({ value: String(year.yearIndex), label: year.label }))
  const comparisonItems = [
    { value: 'priorYear', label: 'Prior year' },
    ...scenarios.map((scenario) => ({ value: scenario.id, label: scenario.name })),
  ]

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 pt-4">
        <Field className="w-44">
          <FieldLabel htmlFor="dashboard-forecast-year">Forecast year</FieldLabel>
          <Select
            id="dashboard-forecast-year"
            items={yearItems}
            value={String(yearIndex)}
            onValueChange={(value) => onYearIndexChange(Number(value))}
          />
        </Field>
        <Field className="w-56">
          <FieldLabel htmlFor="dashboard-comparison">Compare against</FieldLabel>
          <Select
            id="dashboard-comparison"
            items={comparisonItems}
            value={comparisonSelection}
            onValueChange={onComparisonSelectionChange}
          />
        </Field>
        <p className="pb-1.5 text-xs text-muted-foreground">
          Every figure below is drawn from the forecast, cost and capital engines for this year and comparison — none
          of it is invented or measured live.
        </p>
      </CardContent>
    </Card>
  )
}
