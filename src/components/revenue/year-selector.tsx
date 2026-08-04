import { Field, FieldLabel } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import type { Forecast } from '@/engine/revenue'

export function YearSelector({
  forecast,
  selectedYearIndex,
  onChange,
}: {
  forecast: Forecast
  selectedYearIndex: number
  onChange: (yearIndex: number) => void
}) {
  return (
    <Field className="w-48">
      <FieldLabel htmlFor="forecastYear">Forecast year</FieldLabel>
      <Select
        id="forecastYear"
        value={String(selectedYearIndex)}
        items={forecast.years.map((year) => ({ value: String(year.yearIndex), label: year.label }))}
        onValueChange={(value) => onChange(Number(value))}
      />
    </Field>
  )
}
