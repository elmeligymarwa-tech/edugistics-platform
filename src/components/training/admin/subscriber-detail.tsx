import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailItem } from '@/components/ui/detail-item'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAdminTimestamp } from '@/domain/training/format'
import type { SubscriberDetail as SubscriberDetailData } from '@/lib/training/subscribers-admin'
import { ResubscribeSubscriberDialog } from './resubscribe-subscriber-dialog'
import { SubscriberStatusBadge } from './subscriber-status-badge'
import { UnsubscribeSubscriberDialog } from './unsubscribe-subscriber-dialog'

const CONSENT_SOURCE_LABELS: Record<string, string> = {
  TRAINING_REGISTRATION: 'Training registration',
  ADMIN_MANUAL: 'Admin (manual)',
  MIGRATED: 'Migrated',
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  SUBSCRIBED: 'Subscribed',
  UNSUBSCRIBED: 'Unsubscribed',
  RESUBSCRIBED: 'Resubscribed',
}

const EVENT_SOURCE_LABELS: Record<string, string> = {
  TRAINING_REGISTRATION: 'Training registration',
  UNSUBSCRIBE_LINK: 'Unsubscribe link',
  ADMIN_MANUAL: 'Admin (manual)',
  MIGRATED: 'Migrated',
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  const variant = eventType === 'UNSUBSCRIBED' ? 'destructive' : eventType === 'RESUBSCRIBED' ? 'brand' : 'success'
  return <Badge variant={variant}>{EVENT_TYPE_LABELS[eventType] ?? eventType}</Badge>
}

export function SubscriberDetailView({ detail }: { detail: SubscriberDetailData }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{detail.fullName}</CardTitle>
            <div className="flex items-center gap-2">
              <SubscriberStatusBadge status={detail.status} />
              {detail.status === 'SUBSCRIBED' ? (
                <UnsubscribeSubscriberDialog subscriberId={detail.id} fullName={detail.fullName} />
              ) : (
                <ResubscribeSubscriberDialog subscriberId={detail.id} fullName={detail.fullName} />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DetailItem label="Email" value={detail.email} />
          <DetailItem label="Phone" value={detail.phone ?? '—'} />
          <DetailItem label="School" value={detail.schoolName ?? '—'} />
          <DetailItem label="Subject" value={detail.subject ?? '—'} />
          <DetailItem label="Grade" value={detail.grade ?? '—'} />
          <DetailItem label="Date subscribed" value={formatAdminTimestamp(detail.subscribedAt)} />
          {detail.unsubscribedAt && <DetailItem label="Date unsubscribed" value={formatAdminTimestamp(detail.unsubscribedAt)} />}
          <DetailItem label="Source" value={CONSENT_SOURCE_LABELS[detail.consentSource] ?? detail.consentSource} />
          <DetailItem label="Course subscribed from" value={detail.consentCourseName ?? '—'} />
          <DetailItem label="Consent wording version" value={detail.consentWordingVersion} />
          <DetailItem label="Marketing emails received" value={detail.marketingEmailsSent} />
          <DetailItem
            label="Last marketing email"
            value={detail.lastMarketingEmailAt ? formatAdminTimestamp(detail.lastMarketingEmailAt) : '—'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consent history</CardTitle>
          <p className="text-sm text-muted-foreground">
            The evidence trail for this contact&apos;s consent. Every row is permanent — nothing here can be edited or deleted.
          </p>
        </CardHeader>
        <CardContent>
          {detail.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consent events recorded.</p>
          ) : (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Wording version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatAdminTimestamp(event.occurredAt)}</TableCell>
                    <TableCell>
                      <EventTypeBadge eventType={event.eventType} />
                    </TableCell>
                    <TableCell>{EVENT_SOURCE_LABELS[event.source] ?? event.source}</TableCell>
                    <TableCell>{event.courseName ?? '—'}</TableCell>
                    <TableCell>{event.wordingVersion ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
