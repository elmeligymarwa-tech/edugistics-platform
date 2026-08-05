import { Handshake } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailItem } from '@/components/ui/detail-item'
import { StatTile } from '@/components/ui/stat-tile'
import { EmptyState } from '@/components/module-shell/empty-state'
import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { formatMoney, formatPercent } from '@/lib/format'

const BASIS_LABELS: Record<string, string> = {
  grossRevenue: 'Gross revenue',
  netRevenue: 'Net revenue',
  collectedCash: 'Collected cash',
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  termly: 'Termly',
  annual: 'Annual',
}

export function StmOverview({ project, forecast }: { project: Project; forecast: Forecast }) {
  const stm = project.stm

  if (!stm) {
    return (
      <EmptyState
        icon={Handshake}
        title="No STM agreement configured"
        description="This module will hold the terms of a third-party revenue-share or management fee agreement — the counterparty, basis and rate — and calculate the resulting liability for each forecast year from the revenue forecast. There's nothing to configure here yet."
      />
    )
  }

  const startLabel = forecast.years[stm.startYearIndex]?.label ?? `Year ${stm.startYearIndex + 1}`
  const endLabel =
    stm.endYearIndex !== null
      ? (forecast.years[stm.endYearIndex]?.label ?? `Year ${stm.endYearIndex + 1}`)
      : 'Ongoing'

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Agreement terms</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-0 sm:grid-cols-3 lg:grid-cols-4">
          <DetailItem label="Counterparty" value={stm.counterpartyName} />
          <DetailItem label="Basis" value={BASIS_LABELS[stm.basis] ?? stm.basis} />
          {stm.tiers.length === 0 ? <DetailItem label="Rate" value={formatPercent(stm.ratePct)} /> : null}
          <DetailItem
            label="Minimum guarantee"
            value={stm.minimumGuarantee !== null ? formatMoney(stm.minimumGuarantee, project.meta) : 'None'}
          />
          <DetailItem
            label="Payment frequency"
            value={FREQUENCY_LABELS[stm.paymentFrequency] ?? stm.paymentFrequency}
          />
          <DetailItem label="Active from" value={startLabel} />
          <DetailItem label="Active until" value={endLabel} />
        </CardContent>
        {stm.tiers.length > 0 ? (
          <CardContent className="overflow-x-auto pt-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Marginal rate bands</p>
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left font-medium text-muted-foreground">From</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">Rate</th>
                </tr>
              </thead>
              <tbody>
                {stm.tiers.map((tier, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="p-2 text-foreground">{formatMoney(tier.thresholdFrom, project.meta)}</td>
                    <td className="p-2 text-right tabular-nums text-foreground">
                      {formatPercent(tier.ratePct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Total STM liability" value={formatMoney(forecast.totals.stmLiability, project.meta)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Computed liability by forecast year</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left font-medium text-muted-foreground">Year</th>
                <th className="p-2 text-right font-medium text-muted-foreground">STM liability</th>
              </tr>
            </thead>
            <tbody>
              {forecast.years.map((year) => (
                <tr key={year.yearIndex} className="border-t border-border">
                  <td className="p-2 text-foreground">{year.label}</td>
                  <td className="p-2 text-right tabular-nums text-foreground">
                    {formatMoney(year.stmLiability, project.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
