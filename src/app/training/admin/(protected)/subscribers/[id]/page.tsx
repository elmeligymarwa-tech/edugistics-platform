import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { getSubscriberDetail } from '@/lib/training/subscribers-admin'
import { SubscriberDetailView } from '@/components/training/admin/subscriber-detail'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Subscriber — Edugistics Training Admin',
}

export default async function TrainingAdminSubscriberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getSubscriberDetail(id)
  if (!detail) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" render={<Link href="/training/admin/subscribers" />} className="w-fit">
        <ArrowLeft /> Back to subscribers
      </Button>
      <SubscriberDetailView detail={detail} />
    </div>
  )
}
