import { CurrencyText } from '@/components/ui/currency-text'
import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { CapitalForecast } from '@/engine/capital'
import { formatMoney } from '@/lib/format'

export function FinancingSummaryCards({
  project,
  capitalForecast,
}: {
  project: Project
  capitalForecast: CapitalForecast
}) {
  const totalInterest = Object.values(capitalForecast.loans).reduce(
    (sum, schedule) => sum + schedule.reduce((s, year) => s + year.interest, 0),
    0,
  )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        label="Peak debt"
        value={<CurrencyText value={formatMoney(capitalForecast.peakDebt, project.meta)} />}
        term="peak-debt"
        glossaryValue={formatMoney(capitalForecast.peakDebt, project.meta).text}
      />
      <StatTile
        label="Total interest"
        value={<CurrencyText value={formatMoney(totalInterest, project.meta)} />}
        term="total-interest"
        glossaryValue={formatMoney(totalInterest, project.meta).text}
      />
      <StatTile
        label="Minimum cash"
        value={<CurrencyText value={formatMoney(capitalForecast.minimumCash, project.meta)} />}
        term="minimum-cash"
        glossaryValue={formatMoney(capitalForecast.minimumCash, project.meta).text}
      />
    </div>
  )
}
