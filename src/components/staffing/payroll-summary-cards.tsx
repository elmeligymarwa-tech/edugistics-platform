import { CurrencyText } from '@/components/ui/currency-text'
import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'

export function PayrollSummaryCards({
  project,
  costForecast,
}: {
  project: Project
  costForecast: CostForecast
}) {
  const finalPayroll = costForecast.payroll[costForecast.payroll.length - 1]
  const finalStatement = costForecast.years[costForecast.years.length - 1]

  const headcount = finalPayroll?.headcount ?? 0
  const totalPayroll = finalPayroll?.total ?? 0
  const averageCostPerEmployee = headcount > 0 ? totalPayroll / headcount : 0
  const payrollPctOfNetRevenue =
    finalStatement && finalStatement.netRevenue > 0
      ? (totalPayroll / finalStatement.netRevenue) * 100
      : 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Total headcount"
        value={formatNumber(headcount, project.meta.locale)}
        hint={finalStatement?.label}
      />
      <StatTile
        label="Total payroll"
        value={<CurrencyText value={formatMoney(totalPayroll, project.meta)} />}
        hint={finalStatement?.label}
      />
      <StatTile
        label="Average cost per employee"
        value={<CurrencyText value={formatMoney(averageCostPerEmployee, project.meta)} />}
        hint={finalStatement?.label}
      />
      <StatTile
        label="Payroll as % of net revenue"
        value={formatPercent(payrollPctOfNetRevenue)}
        hint={finalStatement?.label}
      />
    </div>
  )
}
