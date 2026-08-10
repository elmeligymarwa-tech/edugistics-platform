'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserX } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { manualUnsubscribeAction } from '@/app/training/admin/(protected)/subscribers/actions'

export function UnsubscribeSubscriberDialog({ subscriberId, fullName }: { subscriberId: string; fullName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUnsubscribe() {
    startTransition(async () => {
      const result = await manualUnsubscribeAction(subscriberId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null) }}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm"><UserX /> Unsubscribe</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsubscribe {fullName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This stops any future marketing email to this contact. Use this after a request by phone or email. The change is
            recorded permanently in their consent history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnsubscribe} disabled={isPending}>
            {isPending ? 'Unsubscribing…' : 'Unsubscribe'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
