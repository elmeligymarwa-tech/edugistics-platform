'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { manualResubscribeAction } from '@/app/training/admin/(protected)/subscribers/actions'
import { RESUBSCRIBE_CONFIRMATION_WORD } from '@/lib/training/subscriber-criteria'

export function ResubscribeSubscriberDialog({ subscriberId, fullName }: { subscriberId: string; fullName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typedConfirmation, setTypedConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setTypedConfirmation('')
    setError(null)
  }

  function handleResubscribe() {
    startTransition(async () => {
      const result = await manualResubscribeAction(subscriberId, typedConfirmation)
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <UserCheck /> Resubscribe
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resubscribe {fullName}?</DialogTitle>
          <DialogDescription>
            Only do this when the teacher has explicitly asked to be put back on the mailing list — for example a phone call
            or email specifically requesting it. This is not a routine action.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="resubscribe-confirm">
            Type <span className="font-mono font-semibold text-foreground">{RESUBSCRIBE_CONFIRMATION_WORD}</span> to confirm
          </FieldLabel>
          <Input
            id="resubscribe-confirm"
            value={typedConfirmation}
            onChange={(event) => setTypedConfirmation(event.target.value)}
            autoComplete="off"
          />
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleResubscribe} disabled={isPending || typedConfirmation !== RESUBSCRIBE_CONFIRMATION_WORD}>
            {isPending ? 'Resubscribing…' : 'Resubscribe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
