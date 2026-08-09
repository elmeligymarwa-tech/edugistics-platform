'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailItem } from '@/components/ui/detail-item'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAdminTimestamp } from '@/domain/training/format'
import { CAMPAIGN_EMAIL_TYPE_LABELS } from '@/domain/training/schema'
import type { CampaignDetailData } from '@/lib/training/email/campaign-analytics'
import { retryFailedRecipientsAction } from '@/app/training/admin/(protected)/registrations/send-actions'
import { EmailStatusBadge } from './registration-badges'

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PENDING', label: 'Pending' },
]

const REFRESH_INTERVAL_MS = 2000

function formatSuccessRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate)}%`
}

/**
 * Historical view of one campaign, rendered server-side from getCampaignDetail.
 * While a campaign is still in flight (attempted < recipientCount) this polls
 * by asking Next to re-render the server component, so it always reflects the
 * database directly rather than any client-held send state.
 */
export function CampaignDetailView({ detail }: { detail: CampaignDetailData }) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [retrying, setRetrying] = useState(false)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)

  const attempted = detail.sentCount + detail.failedCount
  const isComplete = attempted >= detail.recipientCount

  useEffect(() => {
    if (isComplete) return
    const interval = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isComplete, router])

  const filteredRecipients = useMemo(
    () => (statusFilter === 'ALL' ? detail.recipients : detail.recipients.filter((recipient) => recipient.status === statusFilter)),
    [detail.recipients, statusFilter],
  )

  async function handleRetry() {
    setRetrying(true)
    setRetryMessage(null)
    const result = await retryFailedRecipientsAction(detail.id)
    setRetrying(false)
    if (!result.success) {
      setRetryMessage(result.error)
      return
    }
    setRetryMessage(result.data.retriedCount === 0 ? 'No failed recipients to retry.' : `Retrying ${result.data.retriedCount} recipient${result.data.retriedCount === 1 ? '' : 's'}…`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{detail.subject}</CardTitle>
            {!isComplete && <Badge variant="warning">Sending…</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DetailItem label="Date" value={formatAdminTimestamp(detail.createdAt)} />
          <DetailItem label="Course" value={detail.courseName ?? 'Multiple courses'} />
          <DetailItem label="Type" value={CAMPAIGN_EMAIL_TYPE_LABELS[detail.emailType]} />
          <DetailItem label="Recipients" value={detail.recipientCount} />
          <DetailItem label="Sent" value={detail.sentCount} />
          <DetailItem label="Failed" value={detail.failedCount} />
          <DetailItem label="Success rate" value={formatSuccessRate(detail.successRate)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground"
          dangerouslySetInnerHTML={{ __html: detail.renderedBodyHtml }}
        />
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Recipients</CardTitle>
            <div className="flex items-center gap-3">
              <Select
                items={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onValueChange={setStatusFilter}
                triggerClassName="w-40"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleRetry} disabled={retrying || detail.failedCount === 0}>
                {retrying ? 'Retrying…' : 'Retry Failed'}
              </Button>
            </div>
          </div>
          {retryMessage && <p className="text-xs text-muted-foreground">{retryMessage}</p>}
        </CardHeader>
        <CardContent>
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failure reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell>{recipient.teacherName}</TableCell>
                  <TableCell>{recipient.emailAddress}</TableCell>
                  <TableCell>
                    <EmailStatusBadge status={recipient.status} />
                  </TableCell>
                  <TableCell>{recipient.sentAt ? formatAdminTimestamp(recipient.sentAt) : '—'}</TableCell>
                  <TableCell>{recipient.errorMessage ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredRecipients.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No recipients match this status.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
