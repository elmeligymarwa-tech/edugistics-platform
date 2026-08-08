import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DistributionRow } from '@/lib/training/analytics'
import { AnalyticsBarChart } from './analytics-bar-chart'
import { AnalyticsEmptyState } from './empty-state'

export function DistributionPanel({
  title,
  seriesName,
  emptyMessage,
  rows,
}: {
  title: string
  seriesName: string
  emptyMessage: string
  rows: DistributionRow[]
}) {
  const data = rows.map((row) => ({ label: row.label, value: row.count }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        {data.length === 0 ? <AnalyticsEmptyState message={emptyMessage} /> : <AnalyticsBarChart data={data} seriesName={seriesName} />}
      </CardContent>
    </Card>
  )
}
