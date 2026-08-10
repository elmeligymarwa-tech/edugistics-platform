import type { SubscriberStatus } from '@prisma/client'

import { Badge } from '@/components/ui/badge'

export const SUBSCRIBER_STATUS_LABELS: Record<SubscriberStatus, string> = {
  SUBSCRIBED: 'Subscribed',
  UNSUBSCRIBED: 'Unsubscribed',
}

const SUBSCRIBER_STATUS_VARIANTS: Record<SubscriberStatus, 'success' | 'default'> = {
  SUBSCRIBED: 'success',
  UNSUBSCRIBED: 'default',
}

export function SubscriberStatusBadge({ status }: { status: SubscriberStatus }) {
  return <Badge variant={SUBSCRIBER_STATUS_VARIANTS[status]}>{SUBSCRIBER_STATUS_LABELS[status]}</Badge>
}
