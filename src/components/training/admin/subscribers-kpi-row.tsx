import { StatTile } from '@/components/ui/stat-tile'
import type { SubscriberKpis } from '@/lib/training/subscriber-analytics'

export function SubscribersKpiRow({ kpis }: { kpis: SubscriberKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Total subscribers" value={kpis.totalSubscribers} />
      <StatTile label="New in period" value={kpis.newInPeriod} />
      <StatTile label="Unsubscribed in period" value={kpis.unsubscribedInPeriod} />
      <StatTile label="Net growth" value={kpis.netGrowth > 0 ? `+${kpis.netGrowth}` : kpis.netGrowth} />
      <StatTile label="Currently subscribed" value={kpis.currentlySubscribed} />
    </div>
  )
}
