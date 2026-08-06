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
        term="enterprise-value"
        glossaryValue={formatMoney(valuation.enterpriseValue, project.meta).text}
      />
      <StatTile
        label="Net debt"
        value={<CurrencyText value={formatMoney(valuation.netDebt, project.meta)} />}
        term="net-debt"
        glossaryValue={formatMoney(valuation.netDebt, project.meta).text}
      />
      <StatTile
        label="Equity value"
        value={<CurrencyText value={formatMoney(valuation.equityValue, project.meta)} />}
        term="equity-value"
        glossaryValue={formatMoney(valuation.equityValue, project.meta).text}
      />
      <StatTile
        label="NPV"
        value={<CurrencyText value={formatMoney(valuation.npv, project.meta)} />}
        term="npv"
        glossaryValue={formatMoney(valuation.npv, project.meta).text}
      />
      <StatTile
        label="IRR"
        value={valuation.irrPct !== null ? formatPercent(valuation.irrPct) : 'n/a'}
        term="irr"
      />
      <StatTile label="Payback year" value={paybackLabel} term="payback-period" />
    </div>
  )
}
