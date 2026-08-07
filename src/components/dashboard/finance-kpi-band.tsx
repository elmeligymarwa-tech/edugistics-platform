'use client'

import { CurrencyText } from '@/components/ui/currency-text'
import type { DrilldownContent } from '@/components/revenue/cell-drilldown-dialog'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import type { Forecast } from '@/engine/revenue'
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { pctChange, stmRevenueSharePct, type TrendPoint } from '@/lib/kpi'
import type { ComparisonTarget } from './dashboard-overview'
import { KpiCard } from './kpi-card'

export function FinanceKpiBand({
  project,
  forecast,
  costForecast,
  yearIndex,
  comparison,
  onOpenDrilldown,
}: {
  project: Project
  forecast: Forecast
  costForecast: CostForecast
  yearIndex: number
  comparison: ComparisonTarget
  onOpenDrilldown: (content: DrilldownContent) => void
}) {
  const year = forecast.years[yearIndex]
  const statement = costForecast.years[yearIndex]
  const payroll = costForecast.payroll[yearIndex]
  if (!year || !statement || !payroll) return null

  const meta = project.meta
  const stmShare = stmRevenueSharePct(year)

  const comparisonYear =
    comparison.forecast && comparison.yearIndex !== null ? comparison.forecast.years[comparison.yearIndex] : undefined
  const comparisonStatement =
    comparison.costForecast && comparison.yearIndex !== null ? comparison.costForecast.years[comparison.yearIndex] : undefined
  const comparisonStmShare = comparisonYear ? stmRevenueSharePct(comparisonYear) : null

  const trendOf = (extract: (y: (typeof forecast.years)[number]) => number): TrendPoint[] =>
    forecast.years.map((y) => ({ label: y.label, value: extract(y) }))
  const costTrendOf = (extract: (y: (typeof costForecast.years)[number]) => number): TrendPoint[] =>
    costForecast.years.map((y) => ({ label: y.label, value: extract(y) }))

  const cards: Array<{
    label: string
    term?: string
    current: number
    comparisonCurrent: number | null
    invert?: boolean
    trend: TrendPoint[]
    kind: 'money' | 'compactMoney' | 'percent'
    drilldown: () => DrilldownContent
  }> = [
    {
      label: 'Net revenue',
      term: 'net-revenue',
      current: year.netRevenue,
      comparisonCurrent: comparisonYear?.netRevenue ?? null,
      trend: trendOf((y) => y.netRevenue),
      kind: 'compactMoney',
      drilldown: () => ({
        title: 'Net revenue',
        description: `${year.label} — built from gross revenue less discounts.`,
        rows: [
          { label: 'Gross revenue', value: formatMoney(year.grossRevenue, meta) },
          { label: 'Discounts', value: formatMoney(-year.discounts, meta) },
          { label: 'Net revenue', value: formatMoney(year.netRevenue, meta), emphasis: true },
          { label: 'Tax collected', value: formatMoney(year.taxCollected, meta) },
          { label: 'STM revenue share', value: formatMoney(year.stmLiability, meta) },
          { label: 'Collected cash', value: formatMoney(year.collectedCash, meta) },
        ],
      }),
    },
    {
      label: 'EBITDA',
      term: 'ebitda',
      current: statement.ebitda,
      comparisonCurrent: comparisonStatement?.ebitda ?? null,
      trend: costTrendOf((y) => y.ebitda),
      kind: 'compactMoney',
      drilldown: () => ({
        title: 'EBITDA',
        description: `${year.label} — net revenue less payroll, operating cost and STM revenue share.`,
        rows: [
          { label: 'Net revenue', value: formatMoney(statement.netRevenue, meta) },
          { label: 'Payroll cost', value: formatMoney(-statement.payroll, meta) },
          { label: 'Operating cost', value: formatMoney(-statement.opex, meta) },
          { label: 'STM revenue share', value: formatMoney(-statement.stm, meta) },
          { label: 'EBITDA', value: formatMoney(statement.ebitda, meta), emphasis: true },
        ],
      }),
    },
    {
      label: 'EBITDA margin',
      term: 'ebitda-margin',
      current: statement.ebitdaMarginPct,
      comparisonCurrent: comparisonStatement?.ebitdaMarginPct ?? null,
      trend: costTrendOf((y) => y.ebitdaMarginPct),
      kind: 'percent',
      drilldown: () => ({
        title: 'EBITDA margin',
        description: `${year.label} — EBITDA as a share of net revenue.`,
        rows: [
          { label: 'EBITDA', value: formatMoney(statement.ebitda, meta) },
          { label: 'Net revenue', value: formatMoney(statement.netRevenue, meta) },
          { label: 'EBITDA margin', value: formatPercent(statement.ebitdaMarginPct), emphasis: true },
        ],
      }),
    },
    {
      label: 'Net profit',
      term: 'net-profit',
      current: statement.netProfit,
      comparisonCurrent: comparisonStatement?.netProfit ?? null,
      trend: costTrendOf((y) => y.netProfit),
      kind: 'compactMoney',
      drilldown: () => ({
        title: 'Net profit',
        description: `${year.label} — EBITDA less depreciation and tax.`,
        rows: [
          { label: 'EBITDA', value: formatMoney(statement.ebitda, meta) },
          { label: 'Depreciation', value: formatMoney(-statement.depreciation, meta) },
          { label: 'EBIT', value: formatMoney(statement.ebit, meta) },
          { label: 'Tax', value: formatMoney(-statement.tax, meta) },
          { label: 'Net profit', value: formatMoney(statement.netProfit, meta), emphasis: true },
        ],
      }),
    },
    {
      label: 'Payroll cost',
      current: statement.payroll,
      comparisonCurrent: comparisonStatement?.payroll ?? null,
      invert: true,
      trend: costTrendOf((y) => y.payroll),
      kind: 'compactMoney',
      drilldown: () => ({
        title: 'Payroll cost',
        description: `${year.label} — salaries, allowances, on-costs, recruitment and training for ${formatNumber(payroll.headcount, meta.locale)} headcount.`,
        rows: [
          { label: 'Salaries', value: formatMoney(payroll.salaries, meta) },
          { label: 'Allowances', value: formatMoney(payroll.allowances, meta) },
          { label: 'On-costs', value: formatMoney(payroll.onCosts, meta) },
          { label: 'Recruitment', value: formatMoney(payroll.recruitment, meta) },
          { label: 'Training', value: formatMoney(payroll.training, meta) },
          { label: 'Total payroll cost', value: formatMoney(payroll.total, meta), emphasis: true },
        ],
      }),
    },
    {
      label: 'Operating cost',
      current: statement.opex,
      comparisonCurrent: comparisonStatement?.opex ?? null,
      invert: true,
      trend: costTrendOf((y) => y.opex),
      kind: 'compactMoney',
      drilldown: () => ({
        title: 'Operating cost',
        description: `${year.label} — by opex category group.`,
        rows: [
          ...Object.entries(statement.opexByGroup).map(([group, amount]) => ({
            label: group,
            value: formatMoney(amount, meta),
          })),
          { label: 'Total operating cost', value: formatMoney(statement.opex, meta), emphasis: true },
        ],
      }),
    },
    {
      label: 'STM revenue share',
      term: 'revenue-share',
      current: stmShare,
      comparisonCurrent: comparisonStmShare,
      invert: true,
      trend: forecast.years.map((y) => ({ label: y.label, value: stmRevenueSharePct(y) })),
      kind: 'percent',
      drilldown: () => ({
        title: 'STM revenue share',
        description: `${year.label} — STM revenue share as a share of net revenue.`,
        rows: [
          { label: 'STM revenue share (amount)', value: formatMoney(year.stmLiability, meta) },
          { label: 'Net revenue', value: formatMoney(year.netRevenue, meta) },
          { label: 'Share of net revenue', value: formatPercent(stmShare), emphasis: true },
        ],
      }),
    },
    {
      label: 'Revenue per student',
      term: 'revenue-per-student',
      current: year.revenuePerStudent,
      comparisonCurrent: comparisonYear?.revenuePerStudent ?? null,
      trend: trendOf((y) => y.revenuePerStudent),
      kind: 'money',
      drilldown: () => ({
        title: 'Revenue per student',
        description: `${year.label} — net revenue divided by total students.`,
        rows: [
          { label: 'Net revenue', value: formatMoney(year.netRevenue, meta) },
          { label: 'Students', value: formatNumber(year.students, meta.locale) },
          { label: 'Revenue per student', value: formatMoney(year.revenuePerStudent, meta), emphasis: true },
        ],
      }),
    },
    {
      label: 'Cost per student',
      term: 'cost-per-student',
      current: statement.costPerStudent,
      comparisonCurrent: comparisonStatement?.costPerStudent ?? null,
      invert: true,
      trend: costTrendOf((y) => y.costPerStudent),
      kind: 'money',
      drilldown: () => ({
        title: 'Cost per student',
        description: `${year.label} — payroll, operating cost and STM revenue share divided by total students.`,
        rows: [
          { label: 'Payroll cost', value: formatMoney(statement.payroll, meta) },
          { label: 'Operating cost', value: formatMoney(statement.opex, meta) },
          { label: 'STM revenue share', value: formatMoney(statement.stm, meta) },
          { label: 'Students', value: formatNumber(statement.students, meta.locale) },
          { label: 'Cost per student', value: formatMoney(statement.costPerStudent, meta), emphasis: true },
        ],
      }),
    },
    {
      label: 'Closing cash',
      term: 'closing-cash',
      current: statement.closingCash,
      comparisonCurrent: comparisonStatement?.closingCash ?? null,
      trend: costTrendOf((y) => y.closingCash),
      kind: 'compactMoney',
      drilldown: () => ({
        title: 'Closing cash',
        description: `${year.label} — operating cash movement before financing activity.`,
        rows: [
          { label: 'Cash collected', value: formatMoney(statement.cashCollected, meta) },
          { label: 'Cash costs paid', value: formatMoney(-statement.cashCostsPaid, meta) },
          { label: 'Capital expenditure', value: formatMoney(-statement.capexSpend, meta) },
          { label: 'Tax paid', value: formatMoney(-statement.taxPaid, meta) },
          { label: 'Net cash movement', value: formatMoney(statement.netCashMovement, meta) },
          { label: 'Closing cash', value: formatMoney(statement.closingCash, meta), emphasis: true },
        ],
      }),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-heading">Finance</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const formattedValue =
            card.kind === 'percent' ? (
              formatPercent(card.current)
            ) : card.kind === 'money' ? (
              <CurrencyText value={formatMoney(card.current, meta)} />
            ) : (
              <CurrencyText value={formatCompactMoney(card.current, meta)} />
            )
          const formattedComparison =
            card.comparisonCurrent === null
              ? null
              : card.kind === 'percent'
                ? formatPercent(card.comparisonCurrent)
                : formatMoney(card.comparisonCurrent, meta).text
          return (
            <KpiCard
              key={card.label}
              label={card.label}
              term={card.term}
              value={formattedValue}
              glossaryValue={card.kind === 'percent' ? formatPercent(card.current) : formatMoney(card.current, meta).text}
              comparisonValue={formattedComparison}
              comparisonLabel={`vs ${comparison.label}`}
              deltaPct={card.comparisonCurrent !== null ? pctChange(card.current, card.comparisonCurrent) : null}
              invert={card.invert}
              trend={card.trend}
              onOpenDrilldown={() => onOpenDrilldown(card.drilldown())}
            />
          )
        })}
      </div>
    </div>
  )
}
