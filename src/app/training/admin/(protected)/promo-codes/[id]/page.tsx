import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getPromoCodeDetail } from '@/lib/training/promo-codes'
import { PromoCodeDetailView } from '@/components/training/admin/promo-code-detail-view'

export const metadata: Metadata = {
  title: 'Promo Code — Edugistics Training Admin',
}

export default async function TrainingAdminPromoCodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getPromoCodeDetail(id)
  if (!detail) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" render={<Link href="/training/admin/promo-codes" />} className="w-fit">
        <ArrowLeft /> Back to promo codes
      </Button>
      <PromoCodeDetailView detail={detail} />
    </div>
  )
}
