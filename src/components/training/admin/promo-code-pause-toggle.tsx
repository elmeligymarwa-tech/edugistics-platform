'use client'

import { useTransition } from 'react'

import { Switch } from '@/components/ui/switch'
import { setPromoCodePausedAction } from '@/app/training/admin/(protected)/promo-codes/actions'

export function PromoCodePauseToggle({ promoCodeId, isPaused, disabled }: { promoCodeId: string; isPaused: boolean; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition()

  function handleChange(next: boolean) {
    startTransition(async () => {
      // Switch shows "on" as active/resumed — isPaused is the inverse of the checked state.
      await setPromoCodePausedAction(promoCodeId, !next)
    })
  }

  return (
    <Switch
      checked={!isPaused}
      onCheckedChange={handleChange}
      disabled={disabled || isPending}
      aria-label={isPaused ? 'Resume promo code' : 'Pause promo code'}
    />
  )
}
