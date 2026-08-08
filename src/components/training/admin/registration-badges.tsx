import type { EmailStatus, RegistrationStatus } from '@prisma/client'

import { Badge } from '@/components/ui/badge'

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  CONFIRMED: 'Confirmed',
  WAITLISTED: 'Waitlisted',
  CANCELLED: 'Cancelled',
}

const STATUS_VARIANTS: Record<RegistrationStatus, 'success' | 'warning' | 'destructive'> = {
  CONFIRMED: 'success',
  WAITLISTED: 'warning',
  CANCELLED: 'destructive',
}

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
}

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  FAILED: 'Failed',
}

const EMAIL_STATUS_VARIANTS: Record<EmailStatus, 'default' | 'success' | 'destructive'> = {
  PENDING: 'default',
  SENT: 'success',
  FAILED: 'destructive',
}

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  return <Badge variant={EMAIL_STATUS_VARIANTS[status]}>{EMAIL_STATUS_LABELS[status]}</Badge>
}
