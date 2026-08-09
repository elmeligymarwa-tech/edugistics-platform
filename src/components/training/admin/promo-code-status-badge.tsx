import { Badge } from '@/components/ui/badge'
import { PROMO_CODE_STATUS_LABELS, type PromoCodeStatus } from '@/domain/training/promo-code'

const STATUS_VARIANTS: Record<PromoCodeStatus, 'success' | 'warning' | 'default' | 'outline' | 'destructive'> = {
  ACTIVE: 'success',
  SCHEDULED: 'default',
  PAUSED: 'warning',
  EXPIRED: 'destructive',
  EXHAUSTED: 'destructive',
  ARCHIVED: 'outline',
}

export function PromoCodeStatusBadge({ status }: { status: PromoCodeStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{PROMO_CODE_STATUS_LABELS[status]}</Badge>
}
