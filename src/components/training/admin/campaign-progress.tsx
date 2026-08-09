'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getCampaignStatusAction, retryFailedRecipientsAction, type CampaignStatus } from '@/app/training/admin/(protected)/registrations/send-actions'

const POLL_INTERVAL_MS = 1200

/**
 * Live progress and final results for one campaign, driven entirely by
 * polling getCampaignStatusAction — never client-side state left over from
 * the send call itself, so the numbers shown are always what the database
 * currently says. Works identically whether the send just started in this
 * browser session or the composer was reopened against an id from the URL
 * long after the original tab closed.
 */
export function CampaignProgress({ campaignId }: { campaignId: string }) {
  const [status, setStatus] = useState<CampaignStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const mountedRef = useRef(true)

  const poll = useCallback(async () => {
    const result = await getCampaignStatusAction(campaignId)
    if (!mountedRef.current) return
    if (result.success) {
      setStatus(result.data)
      setLoadError(null)
    } else {
      setLoadError(result.error)
    }
  }, [campaignId])

  useEffect(() => {
    mountedRef.current = true
    void poll()
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [poll])

  async function handleRetry() {
    setRetrying(true)
    await retryFailedRecipientsAction(campaignId)
    setRetrying(false)
    await poll()
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>
  }

  if (!status) {
    return <p className="text-sm text-muted-foreground">Loading campaign status…</p>
  }

  const attempted = status.sentCount + status.failedCount
  const isComplete = attempted >= status.recipientCount
  const percent = status.recipientCount === 0 ? 100 : Math.round((attempted / status.recipientCount) * 100)
  const failedRecipients = status.recipients.filter((recipient) => recipient.status === 'FAILED')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">
          {isComplete ? 'Send complete' : `Sending ${attempted} of ${status.recipientCount}`}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-medium text-heading">{status.recipientCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Sent</p>
          <p className="text-lg font-medium text-success">{status.sentCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-lg font-medium text-destructive">{status.failedCount}</p>
        </div>
      </div>

      {isComplete && failedRecipients.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Failed recipients</p>
            <Button type="button" size="sm" variant="outline" onClick={handleRetry} disabled={retrying}>
              {retrying ? 'Retrying…' : 'Retry Failed'}
            </Button>
          </div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
            {failedRecipients.map((recipient) => (
              <p key={recipient.id} className="text-xs text-foreground">
                <span className="font-medium">{recipient.emailAddress}</span>
                {recipient.errorMessage ? <span className="text-muted-foreground"> — {recipient.errorMessage}</span> : null}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
