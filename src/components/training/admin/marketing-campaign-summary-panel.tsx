import { StatTile } from '@/components/ui/stat-tile'
import type { MarketingCampaignSummary } from '@/lib/training/email/marketing-campaign-analytics'

function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate)}%`
}

/**
 * Presentational only — every figure comes straight from getMarketingCampaignSummary
 * (the one authoritative implementation in the analytics layer). No metric here
 * is recalculated; this component only formats what it's given.
 */
export function MarketingCampaignSummaryPanel({ summary }: { summary: MarketingCampaignSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-heading">Marketing email summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Marketing emails sent" value={summary.totalMarketingEmailsSent} />
        <StatTile label="Failed" value={summary.totalFailed} />
        <StatTile label="Success rate" value={formatRate(summary.successRate)} />
        <StatTile label="Campaigns sent" value={summary.campaignsSent} />
      </div>
      <p className="text-xs text-muted-foreground">
        Open rates and click rates aren&apos;t shown — the current Resend integration doesn&apos;t supply that data reliably enough to report.
      </p>
    </div>
  )
}
