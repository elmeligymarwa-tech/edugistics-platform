'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpCircle } from 'lucide-react'

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
import { Button } from '@/components/ui/button'
import { promoteRegistrationAction } from '@/app/training/admin/(protected)/courses/[id]/waitlist/actions'

export function PromoteRegistrationButton({ registrationId, fullName }: { registrationId: string; fullName: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discountLostNote, setDiscountLostNote] = useState(false)

  function promote(override: boolean) {
    startTransition(async () => {
      const result = await promoteRegistrationAction(registrationId, override)
      if (!result.success) {
        if (result.blockedAtCapacity) {
          setOverrideOpen(true)
        } else {
          setError(result.error)
        }
        return
      }
      setError(null)
      setOverrideOpen(false)
      setDiscountLostNote(result.data.discountLost)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" onClick={() => promote(false)} disabled={isPending}>
          <ArrowUpCircle /> {isPending ? 'Promoting…' : 'Promote'}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {discountLostNote && (
          <p className="max-w-[16rem] text-right text-xs text-warning">
            Promoted at full price — the promo code could no longer be honoured.
          </p>
        )}
      </div>

      <AlertDialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This course is at capacity</AlertDialogTitle>
            <AlertDialogDescription>
              Promoting {fullName} now will confirm a place beyond the course&rsquo;s maximum capacity. This override
              is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep waitlisted</AlertDialogCancel>
            <AlertDialogAction onClick={() => promote(true)} disabled={isPending}>
              {isPending ? 'Promoting…' : 'Promote anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
