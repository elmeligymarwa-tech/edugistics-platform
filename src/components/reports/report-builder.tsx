'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import jsPDF from 'jspdf'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { orderedYearGroups, type Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import type { Forecast } from '@/engine/revenue'
import { formatMoney, formatPercent } from '@/lib/format'
import { readPdfTheme, type PdfTheme } from '@/lib/pdf-theme'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'

type SectionKey = 'cover' | 'assumptions' | 'revenue' | 'costs' | 'profitAndLoss' | 'cashFlow' | 'breakEven'

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: 'cover', label: 'Cover page' },
  { key: 'assumptions', label: 'Assumptions summary' },
  { key: 'revenue', label: 'Enrolment and revenue forecast' },
  { key: 'costs', label: 'Cost forecast' },
  { key: 'profitAndLoss', label: 'Profit and loss' },
  { key: 'cashFlow', label: 'Cash flow' },
  { key: 'breakEven', label: 'Break-even summary' },
]

const MARGIN = 15
const LINE_HEIGHT = 6

interface Cursor {
  y: number
}

function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight()
}

function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth()
}

function ensureSpace(doc: jsPDF, cursor: Cursor, needed: number): void {
  if (cursor.y + needed > pageHeight(doc) - MARGIN) {
    doc.addPage()
    cursor.y = MARGIN
  }
}

function addHeading(doc: jsPDF, theme: PdfTheme, cursor: Cursor, text: string): void {
  ensureSpace(doc, cursor, LINE_HEIGHT * 2)
  doc.setFontSize(14)
  doc.setTextColor(...theme['--foreground'])
  doc.text(text, MARGIN, cursor.y)
  cursor.y += LINE_HEIGHT * 1.5
  doc.setDrawColor(...theme['--border'])
  doc.line(MARGIN, cursor.y - LINE_HEIGHT / 2, pageWidth(doc) - MARGIN, cursor.y - LINE_HEIGHT / 2)
}

function addBodyLine(doc: jsPDF, theme: PdfTheme, cursor: Cursor, text: string): void {
  ensureSpace(doc, cursor, LINE_HEIGHT)
  doc.setFontSize(10)
  doc.setTextColor(...theme['--muted-foreground'])
  doc.text(text, MARGIN, cursor.y)
  cursor.y += LINE_HEIGHT
}

function addTable(doc: jsPDF, theme: PdfTheme, cursor: Cursor, header: string[], rows: string[][]): void {
  const usableWidth = pageWidth(doc) - MARGIN * 2
  const colWidth = usableWidth / header.length

  ensureSpace(doc, cursor, LINE_HEIGHT)
  doc.setFontSize(9)
  doc.setTextColor(...theme['--muted-foreground'])
  header.forEach((cell, index) => {
    const x = MARGIN + colWidth * index
    doc.text(cell, x, cursor.y, { align: index === 0 ? 'left' : 'right', maxWidth: colWidth - 2 })
  })
  cursor.y += LINE_HEIGHT
  doc.setDrawColor(...theme['--border'])
  doc.line(MARGIN, cursor.y - LINE_HEIGHT / 2, pageWidth(doc) - MARGIN, cursor.y - LINE_HEIGHT / 2)

  doc.setTextColor(...theme['--foreground'])
  for (const row of rows) {
    ensureSpace(doc, cursor, LINE_HEIGHT)
    row.forEach((cell, index) => {
      const x = MARGIN + colWidth * index
      doc.text(cell, x, cursor.y, { align: index === 0 ? 'left' : 'right', maxWidth: colWidth - 2 })
    })
    cursor.y += LINE_HEIGHT
  }
  cursor.y += LINE_HEIGHT / 2
}

function imageFormatFromDataUri(dataUri: string): 'PNG' | 'JPEG' {
  return dataUri.startsWith('data:image/jpeg') || dataUri.startsWith('data:image/jpg') ? 'JPEG' : 'PNG'
}

/** Fetches a static asset and inlines it as a data URI — jsPDF's addImage can't take a path. */
async function loadImageAsDataUri(path: string): Promise<string> {
  const response = await fetch(path)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

const BRAND_LOGO_ASPECT = 649 / 900

function buildCoverSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, brandLogo: string | null): void {
  if (brandLogo) {
    try {
      const width = 26
      doc.addImage(brandLogo, 'PNG', pageWidth(doc) - MARGIN - width, MARGIN, width, width * BRAND_LOGO_ASPECT)
    } catch {
      // Malformed logo data — continue without it rather than failing the export.
    }
  }
  if (project.meta.logoBase64) {
    try {
      doc.addImage(project.meta.logoBase64, imageFormatFromDataUri(project.meta.logoBase64), MARGIN, cursor.y, 30, 30)
      cursor.y += 36
    } catch {
      // Malformed logo data — continue without it rather than failing the export.
    }
  }
  doc.setFontSize(22)
  doc.setTextColor(...theme['--foreground'])
  doc.text(project.meta.schoolName, MARGIN, cursor.y + 10)
  cursor.y += 18
  doc.setFontSize(11)
  doc.setTextColor(...theme['--muted-foreground'])
  doc.text('Financial planning report', MARGIN, cursor.y)
  cursor.y += LINE_HEIGHT
  doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), MARGIN, cursor.y)
  cursor.y += LINE_HEIGHT * 3
  doc.setDrawColor(...theme['--primary'])
  doc.setLineWidth(1)
  doc.line(MARGIN, cursor.y, pageWidth(doc) - MARGIN, cursor.y)
  doc.setLineWidth(0.2)
}

function buildAssumptionsSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project): void {
  addHeading(doc, theme, cursor, 'Assumptions summary')
  addBodyLine(doc, theme, cursor, `Forecast horizon: ${project.calendar.forecastYears} years`)
  addBodyLine(doc, theme, cursor, `Enrolment model: ${project.revenueAssumptions.enrolmentModel}`)
  addBodyLine(
    doc,
    theme,
    cursor,
    `Sibling discount: ${formatPercent(project.revenueAssumptions.discounts.siblingPct)}, scholarship: ${formatPercent(project.revenueAssumptions.discounts.scholarshipPct)}`,
  )
  addBodyLine(doc, theme, cursor, `Bad debt: ${formatPercent(project.revenueAssumptions.collections.badDebtPct)}`)
  addBodyLine(doc, theme, cursor, `Tax rate: ${formatPercent(project.revenueAssumptions.taxRatePct)}`)
}

function buildRevenueSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, forecast: Forecast): void {
  addHeading(doc, theme, cursor, 'Enrolment and revenue forecast')
  addTable(
    doc,
    theme,
    cursor,
    ['Year', 'Students', 'Net revenue', 'Collected cash'],
    forecast.years.map((year) => [
      year.label,
      String(year.students),
      formatMoney(year.netRevenue, project.meta),
      formatMoney(year.collectedCash, project.meta),
    ]),
  )
  const groups = orderedYearGroups(project)
  if (groups.length > 0) {
    addBodyLine(doc, theme, cursor, `Year groups: ${groups.map((group) => YEAR_GROUP_LABELS[group]).join(', ')}`)
  }
}

function buildCostSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, costForecast: CostForecast): void {
  addHeading(doc, theme, cursor, 'Cost forecast')
  addTable(
    doc,
    theme,
    cursor,
    ['Year', 'Payroll', 'Operating expenses', 'STM'],
    costForecast.years.map((year) => [
      year.label,
      formatMoney(year.payroll, project.meta),
      formatMoney(year.opex, project.meta),
      formatMoney(year.stm, project.meta),
    ]),
  )
}

function buildProfitAndLossSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, costForecast: CostForecast): void {
  addHeading(doc, theme, cursor, 'Profit and loss')
  addTable(
    doc,
    theme,
    cursor,
    ['Year', 'Net revenue', 'EBITDA', 'EBIT', 'Net profit'],
    costForecast.years.map((year) => [
      year.label,
      formatMoney(year.netRevenue, project.meta),
      formatMoney(year.ebitda, project.meta),
      formatMoney(year.ebit, project.meta),
      formatMoney(year.netProfit, project.meta),
    ]),
  )
}

function buildCashFlowSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, costForecast: CostForecast): void {
  addHeading(doc, theme, cursor, 'Cash flow')
  addTable(
    doc,
    theme,
    cursor,
    ['Year', 'Cash collected', 'Cash costs paid', 'Net movement', 'Closing cash'],
    costForecast.years.map((year) => [
      year.label,
      formatMoney(year.cashCollected, project.meta),
      formatMoney(year.cashCostsPaid, project.meta),
      formatMoney(year.netCashMovement, project.meta),
      formatMoney(year.closingCash, project.meta),
    ]),
  )
}

function buildBreakEvenSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, costForecast: CostForecast): void {
  addHeading(doc, theme, cursor, 'Break-even summary')
  const breakEvenLabel =
    costForecast.breakEvenYearIndex !== null
      ? (costForecast.years[costForecast.breakEvenYearIndex]?.label ?? 'Not within forecast')
      : 'Not within forecast'
  addBodyLine(doc, theme, cursor, `Break-even year: ${breakEvenLabel}`)
  addBodyLine(doc, theme, cursor, `Cash low point: ${formatMoney(costForecast.cashLowPoint, project.meta)}`)
  addBodyLine(doc, theme, cursor, `Peak funding requirement: ${formatMoney(costForecast.peakFundingRequirement, project.meta)}`)
}

export function ReportBuilder({
  project,
  forecast,
  costForecast,
}: {
  project: Project
  forecast: Forecast
  costForecast: CostForecast
}) {
  const [selected, setSelected] = useState<Set<SectionKey>>(new Set(SECTIONS.map((section) => section.key)))

  const toggle = (key: SectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const generate = async () => {
    if (selected.size === 0) return

    const brandLogo = selected.has('cover')
      ? await loadImageAsDataUri('/brand/logo-light.png').catch(() => null)
      : null

    const doc = new jsPDF()
    const theme = readPdfTheme()
    const cursor: Cursor = { y: MARGIN }
    let started = false

    const startSection = () => {
      if (started) {
        doc.addPage()
        cursor.y = MARGIN
      }
      started = true
    }

    if (selected.has('cover')) {
      startSection()
      buildCoverSection(doc, theme, cursor, project, brandLogo)
    }
    if (selected.has('assumptions')) {
      startSection()
      buildAssumptionsSection(doc, theme, cursor, project)
    }
    if (selected.has('revenue')) {
      startSection()
      buildRevenueSection(doc, theme, cursor, project, forecast)
    }
    if (selected.has('costs')) {
      startSection()
      buildCostSection(doc, theme, cursor, project, costForecast)
    }
    if (selected.has('profitAndLoss')) {
      startSection()
      buildProfitAndLossSection(doc, theme, cursor, project, costForecast)
    }
    if (selected.has('cashFlow')) {
      startSection()
      buildCashFlowSection(doc, theme, cursor, project, costForecast)
    }
    if (selected.has('breakEven')) {
      startSection()
      buildBreakEvenSection(doc, theme, cursor, project, costForecast)
    }

    doc.save(`${project.meta.schoolName} - financial plan.pdf`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report sections</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <label key={section.key} className="flex items-center gap-2 text-sm text-foreground">
              <Switch checked={selected.has(section.key)} onCheckedChange={() => toggle(section.key)} />
              {section.label}
            </label>
          ))}
        </div>
        <Button type="button" onClick={generate} disabled={selected.size === 0} className="self-start">
          <FileDown data-icon="inline-start" />
          Generate PDF
        </Button>
      </CardContent>
    </Card>
  )
}
