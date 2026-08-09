import { StatTile } from '@/components/ui/stat-tile'
import type { CommunicationSummary } from '@/lib/training/email/campaign-analytics'

function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate)}%`
}

/**
 * Presentational only — every figure comes straight from getCommunicationSummary
 * (the one authoritative implementation in the analytics layer). No metric here
 * is recalculated; this component only formats what it's given.
 */
export function CommunicationSummaryPanel({ summary }: { summary: CommunicationSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-heading">Communication summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Campaign emails sent" value={summary.totalCampaignEmails} />
        <StatTile label="Successful" value={summary.totalSuccessful} />
        <StatTile label="Failed" value={summary.totalFailed} />
        <StatTile label="Success rate" value={formatRate(summary.successRate)} />
        <StatTile label="Courses communicated about" value={summary.distinctCoursesCommunicated} />
        <StatTile label="Teachers contacted" value={summary.distinctTeachersContacted} />
      </div>
      <p className="text-xs text-muted-foreground">
        Open rates, click rates and bounce rates aren&apos;t shown — the current Resend integration doesn&apos;t supply that data reliably enough to report.
      </p>
    </div>
  )
}
