import { CurrencyText } from '@/components/ui/currency-text'
import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { CapitalForecast } from '@/engine/capital'
import { formatMoney, formatPercent } from '@/lib/format'

export function ValuationSummaryCards({
  project,
  capitalForecast,
}: {
  project: Project
  capitalForecast: CapitalForecast
}) {
  const { valuation } = capitalForecast
  const paybackLabel =
    valuation.paybackYearIndex !== null
      ? (capitalForecast.years[valuation.paybackYearIndex]?.label ?? 'Not within forecast')
      : 'Not within forecast'

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile
        label="Enterprise value"
        value={<CurrencyText value={formatMoney(valuation.enterpriseValue, project.meta)} />}
      />
      <StatTile label="Net debt" value={<CurrencyText value={formatMoney(valuation.netDebt, project.meta)} />} />
      <StatTile
        label="Equity value"
        value={<CurrencyText value={formatMoney(valuation.equityValue, project.meta)} />}
      />
      <StatTile label="NPV" value={<CurrencyText value={formatMoney(valuation.npv, project.meta)} />} />
      <StatTile label="IRR" value={valuation.irrPct !== null ? formatPercent(valuation.irrPct) : 'n/a'} />
      <StatTile label="Payback year" value={paybackLabel} />
    </div>
  )
}
