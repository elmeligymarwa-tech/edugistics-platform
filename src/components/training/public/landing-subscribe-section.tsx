'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LANDING_PAGE_CONSENT_WORDING } from '@/domain/training/consent-wording'

interface FieldErrors {
  fullName?: string
  email?: string
}

export function LandingSubscribeSection() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})
    setSubmitting(true)

    try {
      const response = await fetch('/api/training/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, website }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setFormError(body?.error ?? 'Something went wrong. Please try again.')
        if (body?.fieldErrors) setFieldErrors(body.fieldErrors)
        return
      }

      setSubscribed(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 py-16 text-center">
        <h2 className="font-heading text-2xl text-heading sm:text-3xl">Stay ahead with Edugistics</h2>
        <p className="max-w-md text-muted-foreground">
          Join our mailing list for early access to new courses and webinars, plus discount codes for paid training.
        </p>

        {subscribed ? (
          <p className="mt-4 text-base font-medium text-foreground">
            You are subscribed. Watch your inbox for early access and discount codes.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex w-full max-w-sm flex-col gap-3 text-left">
            <Field>
              <FieldLabel htmlFor="subscribe-fullName">Full name</FieldLabel>
              <Input
                id="subscribe-fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-invalid={Boolean(fieldErrors.fullName)}
                autoComplete="name"
              />
              <FieldError>{fieldErrors.fullName}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="subscribe-email">Email address</FieldLabel>
              <Input
                id="subscribe-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                autoComplete="email"
              />
              <FieldError>{fieldErrors.email}</FieldError>
            </Field>

            {/* Honeypot — hidden from real visitors via CSS and kept out of the tab order; any value here marks the submission as automated. */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="subscribe-website">Website</label>
              <input
                id="subscribe-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <Button type="submit" disabled={submitting} className="mt-1">
              {submitting ? 'Subscribing…' : 'Subscribe'}
            </Button>

            <p className="text-xs text-muted-foreground">{LANDING_PAGE_CONSENT_WORDING}</p>
          </form>
        )}
      </div>
    </section>
  )
}
