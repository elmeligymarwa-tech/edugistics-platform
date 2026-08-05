'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { orderedYearGroups, type Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { downloadCsv } from '@/lib/csv'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'
import { CellDrilldownDialog, type DrilldownContent, type DrilldownRow } from './cell-drilldown-dialog'

type RowMode = 'yearGroup' | 'category'

type FlowMetricKey = 'discounts' | 'netRevenue' | 'collectedCash' | 'stmLiability'

const FLOW_METRICS: Array<{ key: FlowMetricKey; label: string }> = [
  { key: 'discounts', label: 'Discounts' },
  { key: 'netRevenue', label: 'Net revenue' },
  { key: 'collectedCash', label: 'Collected cash' },
  { key: 'stmLiability', label: 'STM liability' },
]

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

export function ForecastTable({ project, forecast }: { project: Project; forecast: Forecast }) {
  const [rowMode, setRowMode] = useState<RowMode>('yearGroup')
  const [cumulative, setCumulative] = useState(false)
  const [drilldown, setDrilldown] = useState<DrilldownContent | null>(null)

  const groups = orderedYearGroups(project)
  const categories = project.fees.categories
  const rows =
    rowMode === 'yearGroup'
      ? groups.map((group) => ({ id: group, label: YEAR_GROUP_LABELS[group] }))
      : categories.map((category) => ({ id: category.id, label: category.name }))

  const annualBreakdown = (rowId: string, yearIndex: number): number => {
    const year = forecast.years[yearIndex]
    if (!year) return 0
    return rowMode === 'yearGroup' ? (year.byYearGroup[rowId] ?? 0) : (year.byCategory[rowId] ?? 0)
  }

  const breakdownValue = (rowId: string, yearIndex: number): number => {
    if (!cumulative) return annualBreakdown(rowId, yearIndex)
    let sum = 0
    for (let y = 0; y <= yearIndex; y += 1) sum += annualBreakdown(rowId, y)
    return sum
  }

  const totalValue = (yearIndex: number): number => {
    if (!cumulative) return forecast.years[yearIndex]?.grossRevenue ?? 0
    let sum = 0
    for (let y = 0; y <= yearIndex; y += 1) sum += forecast.years[y]?.grossRevenue ?? 0
    return sum
  }

  const flowValue = (key: FlowMetricKey, yearIndex: number): number => {
    if (!cumulative) return forecast.years[yearIndex]?.[key] ?? 0
    let sum = 0
    for (let y = 0; y <= yearIndex; y += 1) sum += forecast.years[y]?.[key] ?? 0
    return sum
  }

  const cumulativeBasisRow = (yearIndex: number): DrilldownRow | null =>
    cumulative
      ? {
          label: 'Basis',
          value: `Cumulative, ${forecast.years[0]?.label} → ${forecast.years[yearIndex]?.label}`,
        }
      : null

  const openBreakdownDrilldown = (rowId: string, rowLabel: string, yearIndex: number) => {
    const year = forecast.years[yearIndex]
    if (!year) return
    const value = breakdownValue(rowId, yearIndex)
    const detail: DrilldownRow[] = [{ label: 'Gross revenue', value: formatMoney(value, project.meta), emphasis: true }]

    const basis = cumulativeBasisRow(yearIndex)
    if (basis) {
      detail.push(basis)
      for (let y = 0; y <= yearIndex; y += 1) {
        const yr = forecast.years[y]
        if (!yr) continue
        detail.push({ label: yr.label, value: formatMoney(annualBreakdown(rowId, y), project.meta) })
      }
    }

    if (rowMode === 'yearGroup') {
      const enrolment = year.enrolment.find((entry) => entry.yearGroup === rowId)
      if (enrolment) {
        detail.push({ label: 'Students', value: formatNumber(enrolment.students, project.meta.locale) })
        detail.push({ label: 'New entrants', value: formatNumber(enrolment.newEntrants, project.meta.locale) })
        detail.push({
          label: 'Capacity ceiling',
          value: formatNumber(enrolment.capacityCeiling, project.meta.locale),
        })
        if (enrolment.students > 0) {
          detail.push({
            label: 'Revenue per student',
            value: formatMoney(annualBreakdown(rowId, yearIndex) / enrolment.students, project.meta),
          })
        }
      }
    } else {
      const category = categories.find((entry) => entry.id === rowId)
      if (category) {
        detail.push({
          label: 'Mandatory',
          value: category.mandatory ? 'Yes' : `Optional — ${formatPercent(category.uptakePct)} uptake`,
        })
        detail.push({ label: 'Discountable', value: category.discountable ? 'Yes' : 'No' })
        detail.push({ label: 'Included in STM', value: category.includedInStm ? 'Yes' : 'No' })
        detail.push({ label: 'Tax treatment', value: TAX_TREATMENT_LABELS[category.taxTreatment] ?? category.taxTreatment })
        detail.push({
          label: 'Billing frequency',
          value: BILLING_FREQUENCY_LABELS[category.billingFrequency] ?? category.billingFrequency,
        })
        detail.push({ label: 'Charge basis', value: CHARGE_BASIS_LABELS[category.chargeBasis] ?? category.chargeBasis })
        detail.push({
          label: 'Escalation group',
          value: ESCALATION_GROUP_LABELS[category.escalationGroup] ?? category.escalationGroup,
        })
      }
    }

    setDrilldown({ title: rowLabel, description: year.label, rows: detail })
  }

  const openTotalDrilldown = (yearIndex: number) => {
    const year = forecast.years[yearIndex]
    if (!year) return
    const detail: DrilldownRow[] = [
      { label: 'Gross revenue', value: formatMoney(year.grossRevenue, project.meta), emphasis: true },
      { label: 'Discounts', value: formatMoney(year.discounts, project.meta) },
      { label: 'Net revenue', value: formatMoney(year.netRevenue, project.meta) },
      { label: 'Tax collected', value: formatMoney(year.taxCollected, project.meta) },
      { label: 'Collected cash', value: formatMoney(year.collectedCash, project.meta) },
      { label: 'STM liability', value: formatMoney(year.stmLiability, project.meta) },
      { label: 'Students', value: formatNumber(year.students, project.meta.locale) },
      { label: 'Revenue per student', value: formatMoney(year.revenuePerStudent, project.meta) },
    ]
    const basis = cumulativeBasisRow(yearIndex)
    if (basis) detail.unshift(basis)
    setDrilldown({ title: 'Total gross revenue', description: year.label, rows: detail })
  }

  const openFlowDrilldown = (metricKey: FlowMetricKey, metricLabel: string, yearIndex: number) => {
    const year = forecast.years[yearIndex]
    if (!year) return
    const detail: DrilldownRow[] = [
      { label: metricLabel, value: formatMoney(flowValue(metricKey, yearIndex), project.meta), emphasis: true },
      { label: 'Gross revenue', value: formatMoney(year.grossRevenue, project.meta) },
      { label: 'Discounts', value: formatMoney(year.discounts, project.meta) },
      { label: 'Net revenue', value: formatMoney(year.netRevenue, project.meta) },
      { label: 'Collected cash', value: formatMoney(year.collectedCash, project.meta) },
      { label: 'STM liability', value: formatMoney(year.stmLiability, project.meta) },
      { label: 'Students', value: formatNumber(year.students, project.meta.locale) },
    ]
    const basis = cumulativeBasisRow(yearIndex)
    if (basis) detail.push(basis)
    setDrilldown({ title: metricLabel, description: year.label, rows: detail })
  }

  const openStockDrilldown = (key: 'students' | 'revenuePerStudent', label: string, yearIndex: number) => {
    const year = forecast.years[yearIndex]
    if (!year) return
    setDrilldown({
      title: label,
      description: year.label,
      rows: [
        {
          label,
          value: key === 'students' ? formatNumber(year.students, project.meta.locale) : formatMoney(year.revenuePerStudent, project.meta),
          emphasis: true,
        },
        { label: 'Net revenue', value: formatMoney(year.netRevenue, project.meta) },
        { label: 'Students', value: formatNumber(year.students, project.meta.locale) },
      ],
    })
  }

  const handleExport = () => {
    const header = ['', ...forecast.years.map((year) => year.label)]
    const body: string[][] = []

    for (const row of rows) {
      body.push([row.label, ...forecast.years.map((_, y) => formatMoney(breakdownValue(row.id, y), project.meta))])
    }
    body.push([
      'Total gross revenue',
      ...forecast.years.map((_, y) => formatMoney(totalValue(y), project.meta)),
    ])
    for (const metric of FLOW_METRICS) {
      body.push([metric.label, ...forecast.years.map((_, y) => formatMoney(flowValue(metric.key, y), project.meta))])
    }
    body.push([
      'Students (year-end)',
      ...forecast.years.map((year) => formatNumber(year.students, project.meta.locale)),
    ])
    body.push([
      'Revenue per student',
      ...forecast.years.map((year) => formatMoney(year.revenuePerStudent, project.meta)),
    ])

    downloadCsv(`${project.meta.schoolName} - revenue forecast.csv`, [header, ...body])
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Forecast table</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={rowMode === 'yearGroup' ? 'default' : 'outline'}
              onClick={() => setRowMode('yearGroup')}
            >
              By year group
            </Button>
            <Button
              type="button"
              size="sm"
              variant={rowMode === 'category' ? 'default' : 'outline'}
              onClick={() => setRowMode('category')}
            >
              By fee category
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={cumulative} onCheckedChange={setCumulative} />
            Cumulative
          </label>
          <Button type="button" size="sm" variant="outline" onClick={handleExport}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-[32rem] overflow-auto pt-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {rowMode === 'yearGroup'
              ? 'Select year groups in setup to see a forecast breakdown.'
              : 'Add fee categories in setup to see a forecast breakdown.'}
          </p>
        ) : (
          <table className="data-table w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card p-2 text-left font-medium text-muted-foreground">
                  {rowMode === 'yearGroup' ? 'Year group' : 'Fee category'}
                </th>
                {forecast.years.map((year) => (
                  <th key={year.yearIndex} className="p-2 text-right font-medium text-muted-foreground">
                    {year.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="sticky left-0 bg-card p-2 font-medium text-foreground">{row.label}</td>
                  {forecast.years.map((year, y) => (
                    <td key={year.yearIndex} className="p-0 text-right">
                      <button
                        type="button"
                        className="w-full cursor-pointer px-2 py-2 tabular-nums text-foreground outline-none hover:bg-muted focus-visible:bg-muted"
                        onClick={() => openBreakdownDrilldown(row.id, row.label, y)}
                      >
                        {formatMoney(breakdownValue(row.id, y), project.meta)}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="sticky left-0 bg-card p-2 font-semibold text-foreground">Total gross revenue</td>
                {forecast.years.map((year, y) => (
                  <td key={year.yearIndex} className="p-0 text-right">
                    <button
                      type="button"
                      className="w-full cursor-pointer px-2 py-2 font-semibold tabular-nums text-foreground outline-none hover:bg-muted focus-visible:bg-muted"
                      onClick={() => openTotalDrilldown(y)}
                    >
                      {formatMoney(totalValue(y), project.meta)}
                    </button>
                  </td>
                ))}
              </tr>

              <tr>
                <td colSpan={forecast.years.length + 1} className="pt-4 pb-1 text-xs font-medium text-muted-foreground">
                  Financial summary
                </td>
              </tr>
              {FLOW_METRICS.map((metric) => (
                <tr key={metric.key} className="border-t border-border">
                  <td className="sticky left-0 bg-card p-2 text-foreground">{metric.label}</td>
                  {forecast.years.map((year, y) => (
                    <td key={year.yearIndex} className="p-0 text-right">
                      <button
                        type="button"
                        className="w-full cursor-pointer px-2 py-2 tabular-nums text-foreground outline-none hover:bg-muted focus-visible:bg-muted"
                        onClick={() => openFlowDrilldown(metric.key, metric.label, y)}
                      >
                        {formatMoney(flowValue(metric.key, y), project.meta)}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="sticky left-0 bg-card p-2 text-foreground">Students (year-end)</td>
                {forecast.years.map((year, y) => (
                  <td key={year.yearIndex} className="p-0 text-right">
                    <button
                      type="button"
                      className="w-full cursor-pointer px-2 py-2 tabular-nums text-foreground outline-none hover:bg-muted focus-visible:bg-muted"
                      onClick={() => openStockDrilldown('students', 'Students (year-end)', y)}
                    >
                      {formatNumber(year.students, project.meta.locale)}
                    </button>
                  </td>
                ))}
              </tr>
              <tr className="border-t border-border">
                <td className="sticky left-0 bg-card p-2 text-foreground">Revenue per student</td>
                {forecast.years.map((year, y) => (
                  <td key={year.yearIndex} className="p-0 text-right">
                    <button
                      type="button"
                      className="w-full cursor-pointer px-2 py-2 tabular-nums text-foreground outline-none hover:bg-muted focus-visible:bg-muted"
                      onClick={() => openStockDrilldown('revenuePerStudent', 'Revenue per student', y)}
                    >
                      {formatMoney(year.revenuePerStudent, project.meta)}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </CardContent>

      <CellDrilldownDialog content={drilldown} onOpenChange={(open) => !open && setDrilldown(null)} />
    </Card>
  )
}
