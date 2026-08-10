import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { getMarketingCampaignDetail } from '@/lib/training/email/marketing-campaign-analytics'
import { MarketingCampaignDetailView } from '@/components/training/admin/marketing-campaign-detail-view'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Campaign — Edugistics Training Admin',
}

export default async function TrainingAdminMarketingCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getMarketingCampaignDetail(id)
  if (!detail) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" render={<Link href="/training/admin/subscribers/campaigns" />} className="w-fit">
        <ArrowLeft /> Back to campaigns
      </Button>
      <MarketingCampaignDetailView detail={detail} />
    </div>
  )
}
