'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat-tile'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import { formatMoney } from '@/lib/format'

export function StmImpactPanel({ project, costForecast }: { project: Project; costForecast: CostForecast }) {
  const totalStmLiability = costForecast.years.reduce((sum, year) => sum + year.stm, 0)
  const totalEbitda = costForecast.years.reduce((sum, year) => sum + year.ebitda, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Total STM liability" value={formatMoney(totalStmLiability, project.meta)} />
        <StatTile label="EBITDA over horizon" value={formatMoney(totalEbitda, project.meta)} />
        <StatTile label="Net profit over horizon" value={formatMoney(costForecast.totals.netProfit, project.meta)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live impact by forecast year</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[32rem] overflow-auto pt-0">
          <table className="data-table w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left font-medium text-muted-foreground">Year</th>
                <th className="p-2 text-right font-medium text-muted-foreground">STM liability</th>
                <th className="p-2 text-right font-medium text-muted-foreground">EBITDA</th>
                <th className="p-2 text-right font-medium text-muted-foreground">Net profit</th>
              </tr>
            </thead>
            <tbody>
              {costForecast.years.map((year) => (
                <tr key={year.yearIndex} className="border-t border-border">
                  <td className="p-2 text-foreground">{year.label}</td>
                  <td className="p-2 text-right tabular-nums text-foreground">
                    {formatMoney(year.stm, project.meta)}
                  </td>
                  <td className="p-2 text-right tabular-nums text-foreground">
                    {formatMoney(year.ebitda, project.meta)}
                  </td>
                  <td className="p-2 text-right tabular-nums text-foreground">
                    {formatMoney(year.netProfit, project.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium">
                <td className="p-2 text-foreground">Total</td>
                <td className="p-2 text-right tabular-nums text-foreground">
                  {formatMoney(totalStmLiability, project.meta)}
                </td>
                <td className="p-2 text-right tabular-nums text-foreground">
                  {formatMoney(totalEbitda, project.meta)}
                </td>
                <td className="p-2 text-right tabular-nums text-foreground">
                  {formatMoney(costForecast.totals.netProfit, project.meta)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
