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
import { formatCompactMoneySigned, formatMoney, formatPercent, type FormattedCurrency } from '@/lib/format'
import { readPdfTheme, type PdfTheme } from '@/lib/pdf-theme'
import { YEAR_GROUP_LABELS } from '@/lib/wizard-data'

type SectionKey =
  | 'cover'
  | 'executiveSummary'
  | 'assumptions'
  | 'profitAndLoss'
  | 'cashFlow'
  | 'revenue'
  | 'costs'
  | 'breakEven'

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: 'cover', label: 'Cover page' },
  { key: 'executiveSummary', label: 'Executive summary' },
  { key: 'assumptions', label: 'Assumptions summary' },
  { key: 'profitAndLoss', label: 'Profit and loss' },
  { key: 'cashFlow', label: 'Cash flow' },
  { key: 'revenue', label: 'Enrolment and revenue forecast' },
  { key: 'costs', label: 'Cost forecast' },
  { key: 'breakEven', label: 'Break-even summary' },
]

const MARGIN = 15
/** Reserved at the bottom of every page for the running footer — content never enters this band. */
const CONTENT_BOTTOM = 20
const LINE_HEIGHT = 5.5
const TABLE_ROW_HEIGHT = 5
const SECTION_GAP = 5
/** A table that would otherwise strand fewer rows than this before a page break starts fresh instead. */
const MIN_TABLE_ROWS_BEFORE_BREAK = 4

interface Cursor {
  y: number
}

function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight()
}

function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth()
}

/** Advances to a fresh page if `needed` more vertical space won't fit above the footer band. Returns whether it broke. */
function ensureSpace(doc: jsPDF, cursor: Cursor, needed: number): boolean {
  if (cursor.y + needed > pageHeight(doc) - CONTENT_BOTTOM) {
    doc.addPage()
    cursor.y = MARGIN
    return true
  }
  return false
}

/**
 * A heading never sits alone at the foot of a page: `minFollowing` is the
 * height of whatever content immediately follows, so the space check covers
 * the heading plus that content even though only the heading itself is drawn.
 */
function addHeading(doc: jsPDF, theme: PdfTheme, cursor: Cursor, text: string, minFollowing = 0): void {
  const headingHeight = LINE_HEIGHT * 1.6
  ensureSpace(doc, cursor, headingHeight + minFollowing)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...theme['--foreground'])
  doc.text(text, MARGIN, cursor.y)
  doc.setFont('helvetica', 'normal')
  cursor.y += LINE_HEIGHT * 1.1
  doc.setDrawColor(...theme['--border'])
  doc.line(MARGIN, cursor.y, pageWidth(doc) - MARGIN, cursor.y)
  cursor.y += SECTION_GAP * 0.7
}

function addBodyLine(doc: jsPDF, theme: PdfTheme, cursor: Cursor, text: string): void {
  ensureSpace(doc, cursor, LINE_HEIGHT)
  doc.setFontSize(9.5)
  doc.setTextColor(...theme['--muted-foreground'])
  doc.text(text, MARGIN, cursor.y)
  cursor.y += LINE_HEIGHT
}

/** A body line ending in a currency figure — the figure colours coral when negative, same as everywhere else. */
function addBodyLineWithValue(doc: jsPDF, theme: PdfTheme, cursor: Cursor, prefix: string, value: FormattedCurrency): void {
  ensureSpace(doc, cursor, LINE_HEIGHT)
  doc.setFontSize(9.5)
  doc.setTextColor(...theme['--muted-foreground'])
  doc.text(prefix, MARGIN, cursor.y)
  doc.setTextColor(...(value.negative ? theme['--destructive'] : theme['--muted-foreground']))
  doc.text(value.text, MARGIN + doc.getTextWidth(prefix), cursor.y)
  cursor.y += LINE_HEIGHT
}

type TableCell = string | FormattedCurrency

/**
 * Sized to the page width with years as columns. If the table would split
 * across a page break leaving fewer than `MIN_TABLE_ROWS_BEFORE_BREAK` rows
 * on the current page, the whole table starts fresh instead; otherwise it
 * splits and repeats the header row on the continuation page.
 */
function addTable(doc: jsPDF, theme: PdfTheme, cursor: Cursor, header: string[], rows: TableCell[][]): void {
  const usableWidth = pageWidth(doc) - MARGIN * 2
  const colWidth = usableWidth / header.length
  const cellInset = 2
  const rowHeight = TABLE_ROW_HEIGHT

  // The label column is left-aligned from its own left edge; every other
  // column is right-aligned to its own right edge (inset slightly so
  // neighbouring columns never touch) — anchoring every column to the same
  // left edge, as a naive `colWidth * index` would, lets a wide right-aligned
  // value bleed backwards into the previous column.
  const columnX = (index: number) => (index === 0 ? MARGIN : MARGIN + colWidth * (index + 1) - cellInset)
  const columnAlign = (index: number): 'left' | 'right' => (index === 0 ? 'left' : 'right')
  const columnMaxWidth = colWidth - cellInset * 2

  const drawHeaderRow = () => {
    ensureSpace(doc, cursor, rowHeight)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...theme['--muted-foreground'])
    header.forEach((cell, index) => {
      doc.text(cell, columnX(index), cursor.y, { align: columnAlign(index), maxWidth: columnMaxWidth })
    })
    doc.setFont('helvetica', 'normal')
    cursor.y += rowHeight
    doc.setDrawColor(...theme['--border'])
    doc.line(MARGIN, cursor.y - rowHeight / 2, pageWidth(doc) - MARGIN, cursor.y - rowHeight / 2)
  }

  const availableHeight = pageHeight(doc) - CONTENT_BOTTOM - cursor.y - rowHeight
  const rowsThatFit = Math.max(0, Math.floor(availableHeight / rowHeight))
  if (rowsThatFit < rows.length && rowsThatFit < MIN_TABLE_ROWS_BEFORE_BREAK) {
    doc.addPage()
    cursor.y = MARGIN
  }

  drawHeaderRow()
  doc.setFontSize(9)

  for (const row of rows) {
    if (ensureSpace(doc, cursor, rowHeight)) {
      drawHeaderRow()
      doc.setFontSize(9)
    }
    row.forEach((cell, index) => {
      const isCurrency = typeof cell === 'object'
      doc.setTextColor(...(isCurrency && cell.negative ? theme['--destructive'] : theme['--foreground']))
      doc.text(isCurrency ? cell.text : cell, columnX(index), cursor.y, {
        align: columnAlign(index),
        maxWidth: columnMaxWidth,
      })
    })
    cursor.y += rowHeight
  }
  cursor.y += SECTION_GAP * 0.4
}

/** A label/value list laid out in two columns so a short assumptions list uses the full page width. */
function addTwoColumnList(doc: jsPDF, theme: PdfTheme, cursor: Cursor, items: Array<{ label: string; value: string }>): void {
  const usableWidth = pageWidth(doc) - MARGIN * 2
  const colGap = 10
  const colWidth = (usableWidth - colGap) / 2
  const rowsPerColumn = Math.ceil(items.length / 2)
  const rowHeight = LINE_HEIGHT

  ensureSpace(doc, cursor, rowsPerColumn * rowHeight)
  const startY = cursor.y
  doc.setFontSize(9.5)
  items.forEach((item, index) => {
    const column = index < rowsPerColumn ? 0 : 1
    const rowInColumn = index < rowsPerColumn ? index : index - rowsPerColumn
    const x = MARGIN + column * (colWidth + colGap)
    const y = startY + rowInColumn * rowHeight
    doc.setTextColor(...theme['--muted-foreground'])
    doc.text(item.label, x, y)
    doc.setTextColor(...theme['--foreground'])
    doc.text(item.value, x + colWidth, y, { align: 'right', maxWidth: colWidth })
  })
  cursor.y = startY + rowsPerColumn * rowHeight + SECTION_GAP * 0.4
}

interface KpiTile {
  label: string
  value: FormattedCurrency | string
}

/** A compact grid of KPI tiles, sized to the page width. */
function addKpiTiles(doc: jsPDF, theme: PdfTheme, cursor: Cursor, tiles: KpiTile[], columns = 3): void {
  const usableWidth = pageWidth(doc) - MARGIN * 2
  const gap = 5
  const tileWidth = (usableWidth - gap * (columns - 1)) / columns
  const tileHeight = 20
  const rows = Math.ceil(tiles.length / columns)

  ensureSpace(doc, cursor, rows * (tileHeight + gap))
  const startY = cursor.y

  tiles.forEach((tile, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = MARGIN + col * (tileWidth + gap)
    const y = startY + row * (tileHeight + gap)

    doc.setDrawColor(...theme['--border'])
    doc.setFillColor(...theme['--card'])
    doc.roundedRect(x, y, tileWidth, tileHeight, 2, 2, 'FD')

    doc.setFontSize(7.5)
    doc.setTextColor(...theme['--muted-foreground'])
    doc.text(tile.label, x + 4, y + 7, { maxWidth: tileWidth - 8 })

    const { value } = tile
    const isCurrency = typeof value === 'object'
    doc.setFontSize(12.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(isCurrency && value.negative ? theme['--destructive'] : theme['--foreground']))
    doc.text(isCurrency ? value.text : value, x + 4, y + 15.5, { maxWidth: tileWidth - 8 })
    doc.setFont('helvetica', 'normal')
  })

  cursor.y = startY + rows * (tileHeight + gap)
}

/** A compact vector line chart of net revenue against total cost per forecast year — no rasterisation, stays crisp at any zoom. */
function drawRevenueCostChart(
  doc: jsPDF,
  theme: PdfTheme,
  cursor: Cursor,
  project: Project,
  forecast: Forecast,
  costForecast: CostForecast,
): void {
  const usableWidth = pageWidth(doc) - MARGIN * 2
  const chartHeight = 46
  const legendHeight = 9
  const axisLabelHeight = 6

  ensureSpace(doc, cursor, legendHeight + chartHeight + axisLabelHeight)

  const years = forecast.years.map((year, index) => ({
    label: year.label,
    revenue: year.netRevenue,
    cost: (costForecast.years[index]?.payroll ?? 0) + (costForecast.years[index]?.opex ?? 0) + (costForecast.years[index]?.stm ?? 0),
  }))

  const legendY = cursor.y + 3
  doc.setFontSize(8.5)
  doc.setFillColor(...theme['--chart-1'])
  doc.circle(MARGIN + 1.5, legendY - 1, 1.2, 'F')
  doc.setTextColor(...theme['--foreground'])
  doc.text('Net revenue', MARGIN + 4.5, legendY)
  const costLegendX = MARGIN + 4.5 + doc.getTextWidth('Net revenue') + 8
  doc.setFillColor(...theme['--chart-4'])
  doc.circle(costLegendX, legendY - 1, 1.2, 'F')
  doc.text('Cost', costLegendX + 3, legendY)
  cursor.y += legendHeight

  const plotTop = cursor.y
  const plotBottom = cursor.y + chartHeight
  const plotLeft = MARGIN
  const plotRight = MARGIN + usableWidth
  const maxValue = Math.max(1, ...years.map((year) => Math.max(year.revenue, year.cost))) * 1.1

  doc.setDrawColor(...theme['--border'])
  doc.setLineWidth(0.2)
  doc.line(plotLeft, plotBottom, plotRight, plotBottom)

  doc.setFontSize(7)
  doc.setTextColor(...theme['--muted-foreground'])
  doc.text(formatCompactMoneySigned(maxValue, project.meta), plotLeft, plotTop - 1)

  const stepX = years.length > 1 ? (plotRight - plotLeft) / (years.length - 1) : 0
  const xFor = (index: number) => (years.length > 1 ? plotLeft + stepX * index : (plotLeft + plotRight) / 2)
  const yFor = (value: number) => plotBottom - (value / maxValue) * chartHeight

  const drawSeries = (key: 'revenue' | 'cost', colorToken: '--chart-1' | '--chart-4') => {
    doc.setDrawColor(...theme[colorToken])
    doc.setFillColor(...theme[colorToken])
    doc.setLineWidth(0.6)
    for (let index = 0; index < years.length - 1; index += 1) {
      doc.line(xFor(index), yFor(years[index]![key]), xFor(index + 1), yFor(years[index + 1]![key]))
    }
    years.forEach((year, index) => {
      doc.circle(xFor(index), yFor(year[key]), 1, 'F')
    })
    doc.setLineWidth(0.2)
  }

  drawSeries('cost', '--chart-4')
  drawSeries('revenue', '--chart-1')

  cursor.y = plotBottom + 4
  doc.setFontSize(7)
  doc.setTextColor(...theme['--muted-foreground'])
  years.forEach((year, index) => {
    doc.text(year.label, xFor(index), cursor.y, { align: 'center' })
  })
  cursor.y += axisLabelHeight
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

/** Page one only — the cover never shares a page with what follows. */
function buildCoverSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, forecast: Forecast, brandLogo: string | null): void {
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
    } catch {
      // Malformed logo data — continue without it rather than failing the export.
    }
  }
  // Clears both the brand mark (top-right) and the school logo (top-left), whether or not either rendered.
  cursor.y += 40

  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...theme['--foreground'])
  doc.text(project.meta.schoolName, MARGIN, cursor.y)
  doc.setFont('helvetica', 'normal')
  cursor.y += LINE_HEIGHT * 2

  doc.setFontSize(11)
  doc.setTextColor(...theme['--muted-foreground'])
  doc.text('Financial planning report', MARGIN, cursor.y)
  cursor.y += LINE_HEIGHT * 1.6

  doc.setDrawColor(...theme['--primary'])
  doc.setLineWidth(0.6)
  doc.line(MARGIN, cursor.y, pageWidth(doc) - MARGIN, cursor.y)
  doc.setLineWidth(0.2)
  cursor.y += 10

  const firstYear = forecast.years[0]?.label ?? ''
  const lastYear = forecast.years[forecast.years.length - 1]?.label ?? ''
  const period = firstYear && lastYear ? (firstYear === lastYear ? firstYear : `${firstYear} – ${lastYear}`) : ''

  const facts: Array<[string, string]> = [
    ['Currency', project.meta.currencyCode],
    ['Forecast period', period],
    ['Prepared', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
  ]
  doc.setFontSize(10)
  for (const [label, value] of facts) {
    doc.setTextColor(...theme['--muted-foreground'])
    doc.text(label, MARGIN, cursor.y)
    doc.setTextColor(...theme['--foreground'])
    doc.text(value, MARGIN + 40, cursor.y)
    cursor.y += LINE_HEIGHT
  }
}

/** Designed to read as a single page — the headline KPIs, break-even year, peak funding requirement and one chart. */
function buildExecutiveSummarySection(
  doc: jsPDF,
  theme: PdfTheme,
  cursor: Cursor,
  project: Project,
  forecast: Forecast,
  costForecast: CostForecast,
): void {
  addHeading(doc, theme, cursor, 'Executive summary', 50)

  const yearOne = forecast.years[0]
  const finalYear = forecast.years[forecast.years.length - 1]
  const finalStatement = costForecast.years[costForecast.years.length - 1]
  const breakEvenLabel =
    costForecast.breakEvenYearIndex !== null
      ? (costForecast.years[costForecast.breakEvenYearIndex]?.label ?? 'Not within forecast')
      : 'Not within forecast'

  const tiles: KpiTile[] = [
    { label: 'Year one net revenue', value: formatMoney(yearOne?.netRevenue ?? 0, project.meta) },
    { label: 'Final year net revenue', value: formatMoney(finalYear?.netRevenue ?? 0, project.meta) },
    { label: 'Final year EBITDA', value: formatMoney(finalStatement?.ebitda ?? 0, project.meta) },
    { label: 'EBITDA margin', value: formatPercent(finalStatement?.ebitdaMarginPct ?? 0) },
    { label: 'Break-even year', value: breakEvenLabel },
    { label: 'Peak funding requirement', value: formatMoney(costForecast.peakFundingRequirement, project.meta) },
  ]

  addKpiTiles(doc, theme, cursor, tiles)
  cursor.y += SECTION_GAP * 0.6
  drawRevenueCostChart(doc, theme, cursor, project, forecast, costForecast)
}

function buildAssumptionsSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project): void {
  addHeading(doc, theme, cursor, 'Assumptions summary', 30)
  const a = project.revenueAssumptions

  const items: Array<{ label: string; value: string }> = [
    { label: 'Forecast horizon', value: `${project.calendar.forecastYears} years` },
    { label: 'Enrolment model', value: a.enrolmentModel === 'occupancy' ? 'Occupancy-driven' : 'Cohort progression' },
    { label: 'Tuition escalation', value: formatPercent(typeof a.tuitionEscalationPct === 'number' ? a.tuitionEscalationPct : 0) },
    { label: 'Other fee escalation', value: formatPercent(typeof a.otherFeeEscalationPct === 'number' ? a.otherFeeEscalationPct : 0) },
    { label: 'Sibling discount', value: formatPercent(a.discounts.siblingPct) },
    { label: 'Staff child discount', value: formatPercent(a.discounts.staffChildPct) },
    { label: 'Scholarship discount', value: formatPercent(a.discounts.scholarshipPct) },
    { label: 'Early payment discount', value: formatPercent(a.discounts.earlyPaymentPct) },
    { label: 'Bad debt', value: formatPercent(a.collections.badDebtPct) },
    { label: 'Days sales outstanding', value: `${a.collections.dsoDays} days` },
    { label: 'Tax rate', value: formatPercent(a.taxRatePct) },
    { label: 'STM agreement', value: project.stm ? `${project.stm.counterpartyName} — ${formatPercent(project.stm.ratePct)}` : 'None' },
  ]

  addTwoColumnList(doc, theme, cursor, items)

  const groups = orderedYearGroups(project)
  if (groups.length > 0) {
    addBodyLine(doc, theme, cursor, `Year groups: ${groups.map((group) => YEAR_GROUP_LABELS[group]).join(', ')}`)
  }
}

function buildRevenueSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, forecast: Forecast): void {
  addHeading(doc, theme, cursor, 'Enrolment and revenue forecast', TABLE_ROW_HEIGHT * (MIN_TABLE_ROWS_BEFORE_BREAK + 1))
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
  addHeading(doc, theme, cursor, 'Cost forecast', TABLE_ROW_HEIGHT * (MIN_TABLE_ROWS_BEFORE_BREAK + 1))
  addTable(
    doc,
    theme,
    cursor,
    ['Year', 'Payroll', 'Operating expenses', 'STM share'],
    costForecast.years.map((year) => [
      year.label,
      formatMoney(year.payroll, project.meta),
      formatMoney(year.opex, project.meta),
      formatMoney(year.stm, project.meta),
    ]),
  )
}

function buildProfitAndLossSection(doc: jsPDF, theme: PdfTheme, cursor: Cursor, project: Project, costForecast: CostForecast): void {
  addHeading(doc, theme, cursor, 'Profit and loss', TABLE_ROW_HEIGHT * (MIN_TABLE_ROWS_BEFORE_BREAK + 1))
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
  addHeading(doc, theme, cursor, 'Cash flow', TABLE_ROW_HEIGHT * (MIN_TABLE_ROWS_BEFORE_BREAK + 1))
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
  addHeading(doc, theme, cursor, 'Break-even summary', LINE_HEIGHT * 3)
  const breakEvenLabel =
    costForecast.breakEvenYearIndex !== null
      ? (costForecast.years[costForecast.breakEvenYearIndex]?.label ?? 'Not within forecast')
      : 'Not within forecast'
  addBodyLine(doc, theme, cursor, `Break-even year: ${breakEvenLabel}`)
  addBodyLineWithValue(doc, theme, cursor, 'Cash low point: ', formatMoney(costForecast.cashLowPoint, project.meta))
  addBodyLineWithValue(
    doc,
    theme,
    cursor,
    'Peak funding requirement: ',
    formatMoney(costForecast.peakFundingRequirement, project.meta),
  )
}

/** Every page gets the school name, page number and total page count — drawn last, once the total is known. */
function addFooters(doc: jsPDF, theme: PdfTheme, schoolName: string): void {
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    const width = pageWidth(doc)
    const height = pageHeight(doc)
    doc.setDrawColor(...theme['--border'])
    doc.setLineWidth(0.2)
    doc.line(MARGIN, height - 13, width - MARGIN, height - 13)
    doc.setFontSize(8)
    doc.setTextColor(...theme['--muted-foreground'])
    doc.text(schoolName, MARGIN, height - 8)
    doc.text(`Page ${page} of ${totalPages}`, width - MARGIN, height - 8, { align: 'right' })
  }
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

    // The cover is the only section that forces a page break — every other
    // section flows on continuously and only breaks when content genuinely
    // runs out of room (or a table would otherwise strand too few rows).
    if (selected.has('cover')) {
      buildCoverSection(doc, theme, cursor, project, forecast, brandLogo)
      doc.addPage()
      cursor.y = MARGIN
    }
    if (selected.has('executiveSummary')) {
      buildExecutiveSummarySection(doc, theme, cursor, project, forecast, costForecast)
      cursor.y += SECTION_GAP
    }
    if (selected.has('assumptions')) {
      buildAssumptionsSection(doc, theme, cursor, project)
      cursor.y += SECTION_GAP
    }
    if (selected.has('profitAndLoss')) {
      buildProfitAndLossSection(doc, theme, cursor, project, costForecast)
      cursor.y += SECTION_GAP
    }
    if (selected.has('cashFlow')) {
      buildCashFlowSection(doc, theme, cursor, project, costForecast)
      cursor.y += SECTION_GAP
    }
    if (selected.has('revenue')) {
      buildRevenueSection(doc, theme, cursor, project, forecast)
      cursor.y += SECTION_GAP
    }
    if (selected.has('costs')) {
      buildCostSection(doc, theme, cursor, project, costForecast)
      cursor.y += SECTION_GAP
    }
    if (selected.has('breakEven')) {
      buildBreakEvenSection(doc, theme, cursor, project, costForecast)
    }

    addFooters(doc, theme, project.meta.schoolName)
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
