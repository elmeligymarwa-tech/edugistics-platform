'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Step = 'confirm' | 'unsubscribed' | 'already-unsubscribed' | 'resubscribed' | 'error'

export function UnsubscribeConfirm({
  token,
  maskedEmail,
  alreadyUnsubscribed,
}: {
  token: string
  maskedEmail: string
  alreadyUnsubscribed: boolean
}) {
  const [step, setStep] = useState<Step>(alreadyUnsubscribed ? 'already-unsubscribed' : 'confirm')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/training/unsubscribe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? 'Something went wrong. Please try again.')
        setStep('error')
        return
      }
      setStep('unsubscribed')
    } finally {
      setPending(false)
    }
  }

  async function handleResubscribe() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/training/unsubscribe/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? 'Something went wrong. Please try again.')
        setStep('error')
        return
      }
      setStep('resubscribed')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        {step === 'confirm' && (
          <>
            <h1 className="font-heading text-xl text-heading">Unsubscribe from Edugistics emails</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;re about to unsubscribe <span className="font-medium text-foreground">{maskedEmail}</span> from
              Edugistics marketing emails.
            </p>
            <Button onClick={handleConfirm} disabled={pending} className="mt-2">
              {pending ? 'Unsubscribing…' : 'Confirm unsubscribe'}
            </Button>
          </>
        )}

        {step === 'unsubscribed' && (
          <>
            <h1 className="font-heading text-xl text-heading">You have been unsubscribed from Edugistics marketing emails.</h1>
            <p className="text-sm text-muted-foreground">
              Didn&apos;t mean to? You can undo this.
            </p>
            <Button variant="outline" onClick={handleResubscribe} disabled={pending} className="mt-2">
              {pending ? 'Resubscribing…' : 'Resubscribe'}
            </Button>
          </>
        )}

        {step === 'already-unsubscribed' && (
          <>
            <h1 className="font-heading text-xl text-heading">You&apos;re not currently subscribed</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{maskedEmail}</span> is already unsubscribed from Edugistics
              marketing emails.
            </p>
            <Button variant="outline" onClick={handleResubscribe} disabled={pending} className="mt-2">
              {pending ? 'Resubscribing…' : 'Resubscribe'}
            </Button>
          </>
        )}

        {step === 'resubscribed' && (
          <>
            <h1 className="font-heading text-xl text-heading">You&apos;re subscribed again</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{maskedEmail}</span> will continue receiving Edugistics
              marketing emails. You can unsubscribe again at any time using this same link.
            </p>
          </>
        )}

        {step === 'error' && (
          <>
            <h1 className="font-heading text-xl text-heading">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
