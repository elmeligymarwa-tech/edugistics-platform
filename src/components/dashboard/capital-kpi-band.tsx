'use client'

import { CurrencyText } from '@/components/ui/currency-text'
import type { DrilldownContent } from '@/components/revenue/cell-drilldown-dialog'
import type { Project } from '@/domain/schema'
import type { CapitalForecast } from '@/engine/capital'
import type { CostForecast } from '@/engine/costs'
import { formatCompactMoney, formatMoney, formatPercent } from '@/lib/format'
import { cumulativeSeries, pctChange, type TrendPoint } from '@/lib/kpi'
import type { ComparisonTarget } from './dashboard-overview'
import { KpiCard } from './kpi-card'

function yearIndexLabel(index: number | null, years: Array<{ label: string }>, notReached: string): string {
  if (index === null) return notReached
  return years[index]?.label ?? notReached
}

export function CapitalKpiBand({
  project,
  costForecast,
  capitalForecast,
  comparison,
  onOpenDrilldown,
}: {
  project: Project
  costForecast: CostForecast
  capitalForecast: CapitalForecast
  comparison: ComparisonTarget
  onOpenDrilldown: (content: DrilldownContent) => void
}) {
  const meta = project.meta
  const valuation = capitalForecast.valuation
  const comparisonCapital = comparison.capitalForecast
  const comparisonAvailable = comparisonCapital !== null
  /**
   * Break-even year and peak funding requirement are whole-of-plan aggregates on
   * CostForecast, not tied to the selected year — but in "prior year" comparison
   * mode `comparison.costForecast` is the *same* CostForecast object used to read
   * per-year figures elsewhere, so comparing these aggregates against it would
   * silently compare the metric against itself. Capital forecasts are only ever
   * present for a genuine cross-project (scenario) comparison, so gating on that
   * keeps these two cards honest about when no comparison exists.
   */
  const comparisonCost = comparisonAvailable ? comparison.costForecast : null

  const netProfitTrend: TrendPoint[] = costForecast.years.map((y) => ({ label: y.label, value: y.netProfit }))
  const costClosingCashTrend: TrendPoint[] = costForecast.years.map((y) => ({ label: y.label, value: y.closingCash }))
  const capitalClosingCashTrend: TrendPoint[] = capitalForecast.years.map((y) => ({ label: y.label, value: y.closingCash }))
  const fcfTrend: TrendPoint[] = capitalForecast.years.map((y, i) => ({ label: y.label, value: valuation.freeCashFlows[i] ?? 0 }))
  const cumulativeFcfTrend: TrendPoint[] = capitalForecast.years.map((y, i) => ({
    label: y.label,
    value: cumulativeSeries(valuation.freeCashFlows)[i] ?? 0,
  }))

  const breakEvenLabel = yearIndexLabel(costForecast.breakEvenYearIndex, costForecast.years, 'Not reached within forecast')
  const comparisonBreakEvenLabel = comparisonCost
    ? yearIndexLabel(comparisonCost.breakEvenYearIndex, comparisonCost.years, 'Not reached within forecast')
    : null

  const paybackLabel = yearIndexLabel(valuation.paybackYearIndex, capitalForecast.years, 'Not within forecast')
  const comparisonPaybackLabel = comparisonCapital
    ? yearIndexLabel(comparisonCapital.valuation.paybackYearIndex, comparisonCapital.years, 'Not within forecast')
    : null

  const notAvailableLabel = comparison.yearIndex === null && !comparisonAvailable ? 'No comparison available' : `vs ${comparison.label}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-heading">Capital</h2>
        <p className="text-xs text-muted-foreground">Calculated across the full forecast horizon, not the selected year.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Break-even year"
          term="break-even-year"
          value={breakEvenLabel}
          comparisonValue={comparisonBreakEvenLabel}
          comparisonLabel={notAvailableLabel}
          deltaPct={
            costForecast.breakEvenYearIndex !== null && comparisonCost?.breakEvenYearIndex !== undefined && comparisonCost.breakEvenYearIndex !== null
              ? pctChange(costForecast.breakEvenYearIndex, comparisonCost.breakEvenYearIndex)
              : null
          }
          invert
          trend={netProfitTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Break-even year',
              description: 'The first forecast year in which net profit is zero or positive.',
              rows: costForecast.years.map((y) => ({
                label: y.label,
                value: formatMoney(y.netProfit, meta),
                emphasis: y.yearIndex === costForecast.breakEvenYearIndex,
              })),
            })
          }
        />
        <KpiCard
          label="Peak funding requirement"
          term="peak-funding-requirement"
          value={<CurrencyText value={formatCompactMoney(costForecast.peakFundingRequirement, meta)} />}
          glossaryValue={formatMoney(costForecast.peakFundingRequirement, meta).text}
          comparisonValue={comparisonCost ? formatMoney(comparisonCost.peakFundingRequirement, meta).text : null}
          comparisonLabel={notAvailableLabel}
          deltaPct={comparisonCost ? pctChange(costForecast.peakFundingRequirement, comparisonCost.peakFundingRequirement) : null}
          invert
          trend={costClosingCashTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Peak funding requirement',
              description: 'How much external funding would be needed to keep the cash low point at zero.',
              rows: [
                ...costForecast.years.map((y) => ({
                  label: y.label,
                  value: formatMoney(y.closingCash, meta),
                  emphasis: y.closingCash === costForecast.cashLowPoint,
                })),
                {
                  label: 'Peak funding requirement',
                  value: formatMoney(costForecast.peakFundingRequirement, meta),
                  emphasis: true,
                },
              ],
            })
          }
        />
        <KpiCard
          label="Cash low point"
          term="minimum-cash"
          value={<CurrencyText value={formatCompactMoney(capitalForecast.minimumCash, meta)} />}
          glossaryValue={formatMoney(capitalForecast.minimumCash, meta).text}
          comparisonValue={comparisonCapital ? formatMoney(comparisonCapital.minimumCash, meta).text : null}
          comparisonLabel={notAvailableLabel}
          deltaPct={comparisonCapital ? pctChange(capitalForecast.minimumCash, comparisonCapital.minimumCash) : null}
          trend={capitalClosingCashTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Cash low point',
              description: 'The lowest closing cash balance once financing activity is included.',
              rows: capitalForecast.years.map((y) => ({
                label: y.label,
                value: formatMoney(y.closingCash, meta),
                emphasis: y.closingCash === capitalForecast.minimumCash,
              })),
            })
          }
        />
        <KpiCard
          label="Equity value"
          term="equity-value"
          value={<CurrencyText value={formatCompactMoney(valuation.equityValue, meta)} />}
          glossaryValue={formatMoney(valuation.equityValue, meta).text}
          comparisonValue={comparisonCapital ? formatMoney(comparisonCapital.valuation.equityValue, meta).text : null}
          comparisonLabel={notAvailableLabel}
          deltaPct={comparisonCapital ? pctChange(valuation.equityValue, comparisonCapital.valuation.equityValue) : null}
          trend={fcfTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Equity value',
              description: 'Enterprise value, built from discounted free cash flows and a terminal value, less net debt.',
              rows: [
                { label: 'Enterprise value', value: formatMoney(valuation.enterpriseValue, meta) },
                { label: 'Terminal value (undiscounted)', value: formatMoney(valuation.terminalValue, meta) },
                { label: 'Net debt', value: formatMoney(valuation.netDebt, meta) },
                { label: 'Equity value', value: formatMoney(valuation.equityValue, meta), emphasis: true },
              ],
            })
          }
        />
        <KpiCard
          label="IRR"
          term="irr"
          value={valuation.irrPct === null ? 'Not calculable' : formatPercent(valuation.irrPct)}
          comparisonValue={
            comparisonCapital ? (comparisonCapital.valuation.irrPct === null ? 'Not calculable' : formatPercent(comparisonCapital.valuation.irrPct)) : null
          }
          comparisonLabel={notAvailableLabel}
          deltaPct={
            valuation.irrPct !== null && comparisonCapital?.valuation.irrPct != null
              ? pctChange(valuation.irrPct, comparisonCapital.valuation.irrPct)
              : null
          }
          trend={fcfTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Internal rate of return',
              description: 'Solved from the opening equity/cash outlay, each year of free cash flow, and the terminal value in the final year.',
              rows: [
                ...capitalForecast.years.map((y, i) => ({
                  label: y.label,
                  value: formatMoney(valuation.freeCashFlows[i] ?? 0, meta),
                })),
                {
                  label: 'IRR',
                  value: valuation.irrPct === null ? 'Not calculable' : formatPercent(valuation.irrPct),
                  emphasis: true,
                },
              ],
            })
          }
        />
        <KpiCard
          label="Payback year"
          term="payback-period"
          value={paybackLabel}
          comparisonValue={comparisonPaybackLabel}
          comparisonLabel={notAvailableLabel}
          deltaPct={
            valuation.paybackYearIndex !== null && comparisonCapital?.valuation.paybackYearIndex != null
              ? pctChange(valuation.paybackYearIndex, comparisonCapital.valuation.paybackYearIndex)
              : null
          }
          invert
          trend={cumulativeFcfTrend}
          onOpenDrilldown={() =>
            onOpenDrilldown({
              title: 'Payback year',
              description: 'The first forecast year in which cumulative free cash flow turns zero or positive.',
              rows: cumulativeFcfTrend.map((point, i) => ({
                label: point.label,
                value: formatMoney(point.value, meta),
                emphasis: i === valuation.paybackYearIndex,
              })),
            })
          }
        />
      </div>
    </div>
  )
}
