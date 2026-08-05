'use client'

import { useRef } from 'react'
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ProjectMetaSchema, CalendarConfigSchema, type Project } from '@/domain/schema'
import { fieldMessage } from '@/lib/wizard-validation'
import { CURRENCY_OPTIONS, FORECAST_YEAR_OPTIONS, LOCALE_OPTIONS, MONTH_OPTIONS } from '@/lib/wizard-data'
import { useProjectStore } from '@/store/project-store'

export function Step1SchoolInfo({ project }: { project: Project }) {
  const updateMeta = useProjectStore((state) => state.updateMeta)
  const updateCalendar = useProjectStore((state) => state.updateCalendar)
  const updateRevenueAssumptions = useProjectStore((state) => state.updateRevenueAssumptions)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const schoolPlan = project.revenueAssumptions.schoolPlan
  const setMaxSchoolStudents = (raw: string) =>
    updateRevenueAssumptions(project.id, {
      schoolPlan: {
        ...schoolPlan,
        maxSchoolStudents: raw === '' ? null : Math.max(0, Math.round(Number(raw))),
      },
    })

  const metaResult = ProjectMetaSchema.safeParse(project.meta)
  const calendarResult = CalendarConfigSchema.safeParse(project.calendar)

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateMeta(project.id, { logoBase64: reader.result })
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="schoolName">School name</FieldLabel>
              <Input
                id="schoolName"
                value={project.meta.schoolName}
                onChange={(event) => updateMeta(project.id, { schoolName: event.target.value })}
                aria-invalid={Boolean(fieldMessage(metaResult, 'schoolName'))}
              />
              <FieldError>{fieldMessage(metaResult, 'schoolName')}</FieldError>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel>School logo</FieldLabel>
              <div className="flex items-center gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
                  {project.meta.logoBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.meta.logoBase64}
                      alt="School logo"
                      className="size-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) handleLogoUpload(file)
                    event.target.value = ''
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload data-icon="inline-start" />
                  Upload logo
                </Button>
                {project.meta.logoBase64 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateMeta(project.id, { logoBase64: null })}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="country">Country</FieldLabel>
              <Input
                id="country"
                value={project.meta.country}
                onChange={(event) => updateMeta(project.id, { country: event.target.value })}
                aria-invalid={Boolean(fieldMessage(metaResult, 'country'))}
              />
              <FieldError>{fieldMessage(metaResult, 'country')}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="locale">Locale</FieldLabel>
              <Select
                id="locale"
                value={project.meta.locale}
                items={LOCALE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onValueChange={(value) => updateMeta(project.id, { locale: value })}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="currency">Currency</FieldLabel>
              <Select
                id="currency"
                value={project.meta.currencyCode}
                placeholder="Choose a currency"
                items={CURRENCY_OPTIONS.map((option) => ({
                  value: option.code,
                  label: `${option.code} — ${option.label} (${option.symbol})`,
                }))}
                onValueChange={(code) => {
                  const option = CURRENCY_OPTIONS.find((entry) => entry.code === code)
                  if (!option) return
                  updateMeta(project.id, {
                    currencyCode: option.code,
                    currencySymbol: option.symbol,
                    decimalPlaces: option.decimalPlaces,
                  })
                }}
              />
              <FieldError>{fieldMessage(metaResult, 'currencyCode')}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="currencySymbol">Currency symbol</FieldLabel>
              <Input
                id="currencySymbol"
                value={project.meta.currencySymbol}
                onChange={(event) => updateMeta(project.id, { currencySymbol: event.target.value })}
                aria-invalid={Boolean(fieldMessage(metaResult, 'currencySymbol'))}
              />
              <FieldError>{fieldMessage(metaResult, 'currencySymbol')}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="decimalPlaces">Decimal places</FieldLabel>
              <Input
                id="decimalPlaces"
                type="number"
                min={0}
                max={4}
                value={project.meta.decimalPlaces}
                onChange={(event) =>
                  updateMeta(project.id, { decimalPlaces: Number(event.target.value) })
                }
                aria-invalid={Boolean(fieldMessage(metaResult, 'decimalPlaces'))}
              />
              <FieldError>{fieldMessage(metaResult, 'decimalPlaces')}</FieldError>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="academicYearStart">Academic year start</FieldLabel>
              <Input
                id="academicYearStart"
                type="number"
                value={project.calendar.academicYearStart}
                onChange={(event) =>
                  updateCalendar(project.id, { academicYearStart: Number(event.target.value) })
                }
                aria-invalid={Boolean(fieldMessage(calendarResult, 'academicYearStart'))}
              />
              <FieldError>{fieldMessage(calendarResult, 'academicYearStart')}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="financialYearStartMonth">Financial year start month</FieldLabel>
              <Select
                id="financialYearStartMonth"
                value={String(project.calendar.financialYearStartMonth)}
                items={MONTH_OPTIONS.map((month) => ({ value: String(month.value), label: month.label }))}
                onValueChange={(value) =>
                  updateCalendar(project.id, { financialYearStartMonth: Number(value) })
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="maxSchoolStudents">Maximum school students</FieldLabel>
              <Input
                id="maxSchoolStudents"
                type="number"
                min={0}
                placeholder="No limit"
                value={schoolPlan.maxSchoolStudents ?? ''}
                onChange={(event) => setMaxSchoolStudents(event.target.value)}
              />
              <FieldDescription>Hard ceiling for the whole school, used by top-down planning.</FieldDescription>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel>Forecast duration</FieldLabel>
              <div className="flex gap-2">
                {FORECAST_YEAR_OPTIONS.map((years) => (
                  <Button
                    key={years}
                    type="button"
                    variant={project.calendar.forecastYears === years ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateCalendar(project.id, { forecastYears: years })}
                  >
                    {years} {years === 1 ? 'year' : 'years'}
                  </Button>
                ))}
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
