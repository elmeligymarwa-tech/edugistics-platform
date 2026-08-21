'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { promoteRegistrationAction } from '@/app/training/admin/(protected)/courses/[id]/waitlist/actions'

/**
 * The one place a waitlisted registration gets promoted to CONFIRMED —
 * reused by the dedicated waitlist page (promote-registration-button.tsx)
 * and the registrations table's row-actions menu, so the capacity-override
 * flow and the send-email choice exist in exactly one implementation.
 *
 * Sending the confirmation/joining email is a deliberate choice made here,
 * not an automatic side effect of promotion — someone promoted long after
 * the event (backfilling attendance, correcting a mistake) should not
 * receive a "you're in" email for something already over. Defaults to
 * checked, since promoting someone off an active waiting list for an
 * upcoming course is the common case and usually does want the email.
 */
export function PromoteRegistrationDialog({
  open,
  onOpenChange,
  registrationId,
  fullName,
  onPromoted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  registrationId: string
  fullName: string
  onPromoted?: (result: { discountLost: boolean }) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sendEmail, setSendEmail] = useState(true)
  const [capacityBlocked, setCapacityBlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSendEmail(true)
    setCapacityBlocked(false)
    setError(null)
  }, [open, registrationId])

  function promote(override: boolean) {
    startTransition(async () => {
      const result = await promoteRegistrationAction(registrationId, { override, sendEmail })
      if (!result.success) {
        if (result.blockedAtCapacity) {
          setCapacityBlocked(true)
        } else {
          setError(result.error)
        }
        return
      }
      setError(null)
      onOpenChange(false)
      onPromoted?.(result.data)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{capacityBlocked ? 'This course is at capacity' : `Promote ${fullName} to confirmed?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {capacityBlocked ? (
              <>
                Promoting {fullName} now will confirm a place beyond the course&rsquo;s maximum capacity. This
                override is recorded in the audit log.
              </>
            ) : (
              <>This confirms {fullName}&rsquo;s place on the course and removes them from the waiting list.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox checked={sendEmail} onCheckedChange={setSendEmail} className="mt-0.5" />
          <span>
            Send {fullName} the confirmation email now
            <span className="block text-xs text-muted-foreground">
              Leave this unchecked if you&rsquo;re promoting after the event, backfilling a record, or want to notify
              them yourself.
            </span>
          </span>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>{capacityBlocked ? 'Keep waitlisted' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction onClick={() => promote(capacityBlocked)} disabled={isPending}>
            {isPending ? 'Promoting…' : capacityBlocked ? 'Promote anyway' : 'Promote'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
