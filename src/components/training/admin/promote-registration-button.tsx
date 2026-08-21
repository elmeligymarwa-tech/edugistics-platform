'use client'

import { useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PromoteRegistrationDialog } from './promote-registration-dialog'

export function PromoteRegistrationButton({ registrationId, fullName }: { registrationId: string; fullName: string }) {
  const [open, setOpen] = useState(false)
  const [discountLostNote, setDiscountLostNote] = useState(false)

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={() => setOpen(true)}>
        <ArrowUpCircle /> Promote
      </Button>
      {discountLostNote && (
        <p className="max-w-[16rem] text-right text-xs text-warning">
          Promoted at full price — the promo code could no longer be honoured.
        </p>
      )}
      <PromoteRegistrationDialog
        open={open}
        onOpenChange={setOpen}
        registrationId={registrationId}
        fullName={fullName}
        onPromoted={(result) => setDiscountLostNote(result.discountLost)}
      />
    </div>
  )
}
