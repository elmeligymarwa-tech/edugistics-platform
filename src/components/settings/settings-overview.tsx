import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailItem } from '@/components/ui/detail-item'
import type { Project } from '@/domain/schema'
import { formatNumber } from '@/lib/format'
import { MONTH_OPTIONS } from '@/lib/wizard-data'

export function SettingsOverview({ project }: { project: Project }) {
  const monthLabel =
    MONTH_OPTIONS.find((month) => month.value === project.calendar.financialYearStartMonth)?.label ??
    String(project.calendar.financialYearStartMonth)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>School</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-0 sm:grid-cols-3">
          <DetailItem label="School name" value={project.meta.schoolName} />
          <DetailItem label="Country" value={project.meta.country} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency and locale</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-0 sm:grid-cols-3">
          <DetailItem label="Currency" value={`${project.meta.currencyCode} (${project.meta.currencySymbol})`} />
          <DetailItem label="Decimal places" value={formatNumber(project.meta.decimalPlaces, project.meta.locale)} />
          <DetailItem label="Locale" value={project.meta.locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic calendar</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-0 sm:grid-cols-3">
          <DetailItem label="Academic year start" value={String(project.calendar.academicYearStart)} />
          <DetailItem label="Financial year start month" value={monthLabel} />
          <DetailItem
            label="Forecast horizon"
            value={`${project.calendar.forecastYears} ${project.calendar.forecastYears === 1 ? 'year' : 'years'}`}
          />
          <DetailItem label="Terms per year" value={formatNumber(project.calendar.termsPerYear, project.meta.locale)} />
        </CardContent>
      </Card>
    </div>
  )
}
