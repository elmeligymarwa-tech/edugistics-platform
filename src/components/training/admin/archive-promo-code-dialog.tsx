'use client'

import { useState, useTransition } from 'react'
import { Archive } from 'lucide-react'

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
import { archivePromoCodeAction } from '@/app/training/admin/(protected)/promo-codes/actions'

export function ArchivePromoCodeDialog({ promoCodeId, code }: { promoCodeId: string; code: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleArchive() {
    startTransition(async () => {
      await archivePromoCodeAction(promoCodeId)
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Archive promo code">
            <Archive />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {code}?</AlertDialogTitle>
          <AlertDialogDescription>
            This code stops being usable immediately. Its value can be reused by a future code. Nothing is deleted — history
            referencing it is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleArchive} disabled={isPending}>
            {isPending ? 'Archiving…' : 'Archive'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
