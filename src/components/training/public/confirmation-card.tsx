import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCourseFee } from '@/domain/training/format'
import { hasFiredConversionEvent, markConversionEventFired, trackCompleteRegistration, trackJoinedWaitlist } from '@/lib/meta-pixel/events'
import type { PromoBreakdown } from '@/domain/training/promo-code'

export interface ConfirmedConfirmation {
  status: 'CONFIRMED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  courseDateLong: string
  courseTimeRange: string
  promo: PromoBreakdown | null
  /** Shared with the server-side Conversions API send of this same conversion — see trackCompleteRegistration. Derived (reference + event name), not personal. */
  eventId: string
}

export interface WaitlistedConfirmation {
  status: 'WAITLISTED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  waitlistPosition: number
  promo: PromoBreakdown | null
  /** Shared with the server-side Conversions API send of this same conversion — see trackJoinedWaitlist. Derived (reference + event name), not personal. */
  eventId: string
}

export type Confirmation = ConfirmedConfirmation | WaitlistedConfirmation

function PromoBreakdownSummary({ promo }: { promo: PromoBreakdown }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Original fee</span>
        <span>{formatCourseFee(promo.originalFee, promo.currency)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Promo code</span>
        <span className="font-medium text-foreground">{promo.code}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Discount</span>
        <span>{promo.discountLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">You save</span>
        <span>{formatCourseFee(promo.discountAmount, promo.currency)}</span>
      </div>
      <div className="flex items-center justify-between font-semibold text-foreground">
        <span>Final fee</span>
        <span>{formatCourseFee(promo.finalFee, promo.currency)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Payment is not collected through this form. Payment instructions will be sent separately.
      </p>
    </div>
  )
}

export function ConfirmationCard({
  confirmation,
  onRegisterAnother,
}: {
  confirmation: Confirmation
  onRegisterAnother: () => void
}) {
  const isConfirmed = confirmation.status === 'CONFIRMED'

  // Fires once per registration reference. Route rendering only ever reaches
  // this component after a successful CONFIRMED/WAITLISTED response — a
  // failed submission, duplicate, or full course never sets `confirmation`
  // in the first place, so those never even mount this component. The
  // sessionStorage guard (not just the ref) is what keeps a screen refresh
  // from firing again, since a remount would otherwise re-run this effect.
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current) return
    if (hasFiredConversionEvent(confirmation.reference)) return
    firedRef.current = true
    markConversionEventFired(confirmation.reference)

    if (confirmation.status === 'CONFIRMED') {
      trackCompleteRegistration(confirmation.courseName, confirmation.eventId)
    } else {
      trackJoinedWaitlist(confirmation.courseName, confirmation.eventId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmation.reference])

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col gap-4 pt-4">
        <div>
          <h1 className="font-heading text-2xl text-heading">
            {isConfirmed ? 'Registration confirmed' : 'You are on the waiting list'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you, {confirmation.teacherFullName}.
          </p>
        </div>

        {isConfirmed ? (
          <div className="flex flex-col gap-1 text-sm">
            <p>
              You are registered for: <span className="font-semibold text-foreground">{confirmation.courseName}</span>
            </p>
            <p className="text-muted-foreground">{confirmation.courseDateLong}</p>
            <p className="text-muted-foreground">{confirmation.courseTimeRange}</p>
          </div>
        ) : (
          <p className="text-sm">
            <span className="font-semibold text-foreground">{confirmation.courseName}</span> is currently full. You
            are number <span className="font-semibold text-foreground">{confirmation.waitlistPosition}</span> on the
            waiting list. We will email you if a place becomes available.
          </p>
        )}

        {confirmation.promo && <PromoBreakdownSummary promo={confirmation.promo} />}

        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>
            Reference: <span className="font-mono font-medium text-foreground">{confirmation.reference}</span>
          </p>
          {isConfirmed && (
            <p className="mt-1 text-muted-foreground">Confirmation email sent to: {confirmation.teacherEmail}</p>
          )}
        </div>

        <Button onClick={onRegisterAnother} className="w-full">
          Register for another course
        </Button>
      </CardContent>
    </Card>
  )
}
