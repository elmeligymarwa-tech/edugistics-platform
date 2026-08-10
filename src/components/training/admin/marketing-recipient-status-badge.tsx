import type { MarketingRecipientStatus } from '@prisma/client'

import { Badge } from '@/components/ui/badge'

export const MARKETING_RECIPIENT_STATUS_LABELS: Record<MarketingRecipientStatus, string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  FAILED: 'Failed',
  SKIPPED_UNSUBSCRIBED: 'Skipped (unsubscribed)',
}

const MARKETING_RECIPIENT_STATUS_VARIANTS: Record<MarketingRecipientStatus, 'default' | 'success' | 'destructive' | 'warning'> = {
  PENDING: 'default',
  SENT: 'success',
  FAILED: 'destructive',
  // Not a failure — the recipient unsubscribed, most likely while this very campaign was sending. A distinct colour keeps it from reading as an error at a glance.
  SKIPPED_UNSUBSCRIBED: 'warning',
}

export function MarketingRecipientStatusBadge({ status }: { status: MarketingRecipientStatus }) {
  return <Badge variant={MARKETING_RECIPIENT_STATUS_VARIANTS[status]}>{MARKETING_RECIPIENT_STATUS_LABELS[status]}</Badge>
}
