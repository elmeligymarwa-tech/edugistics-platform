import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { getCampaignDetail } from '@/lib/training/email/campaign-analytics'
import { CampaignDetailView } from '@/components/training/admin/campaign-detail-view'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Campaign — Edugistics Training Admin',
}

export default async function TrainingAdminCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getCampaignDetail(id)
  if (!detail) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" render={<Link href="/training/admin/emails" />} className="w-fit">
        <ArrowLeft /> Back to emails
      </Button>
      <CampaignDetailView detail={detail} />
    </div>
  )
}
