'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MarketingCampaignProgress } from './marketing-campaign-progress'

/**
 * Whenever the URL carries ?campaignId=..., shows that campaign's live or
 * final state — regardless of whether the send was started in this browser
 * session or the tab was closed mid-send and this URL reopened later. Always
 * mounted on the subscribers page so it works independently of whatever
 * selection or composer state currently exists.
 */
export function MarketingCampaignResumeDialog() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('campaignId')

  function close() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('campaignId')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Dialog open={Boolean(campaignId)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-lg" showClose>
        <DialogHeader>
          <DialogTitle>Campaign progress</DialogTitle>
          <DialogDescription>Reflects the database directly — safe to close and reopen at any time.</DialogDescription>
        </DialogHeader>
        {campaignId && <MarketingCampaignProgress campaignId={campaignId} />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
