'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getRecipientSummaryAction, type RecipientSummary } from '@/app/training/admin/(protected)/registrations/email-actions'
import type { RecipientCriteriaInput } from '@/lib/training/email/criteria'
import { SendEmailComposer } from './send-email-composer'

/** Opens the composer preselecting every confirmed registrant for one course — the course-detail entry point to the bulk composer, alongside the registrations-screen selection flow. */
export function SendEmailToRegistrantsButton({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<RecipientSummary | null>(null)

  const criteria: RecipientCriteriaInput = {
    mode: 'filters',
    searchParams: { courseId, status: 'CONFIRMED' },
    excludeIds: [],
    includeWaitlisted: false,
  }

  async function handleClick() {
    setLoading(true)
    const result = await getRecipientSummaryAction(criteria)
    setLoading(false)
    if (result.success) {
      setSummary(result.data)
      setOpen(true)
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Send email to registrants" onClick={handleClick} disabled={loading}>
        <Mail />
      </Button>
      {summary && <SendEmailComposer open={open} onOpenChange={setOpen} criteria={criteria} initialSummary={summary} />}
    </>
  )
}
