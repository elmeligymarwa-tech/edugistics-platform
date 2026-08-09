import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { getRegistrationDetail } from '@/lib/training/registrations'
import { getTeacherCommunicationHistory } from '@/lib/training/email/campaign-analytics'
import { RegistrationDetailView } from '@/components/training/admin/registration-detail'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Registration — Edugistics Training Admin',
}

export default async function TrainingAdminRegistrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  const detail = await getRegistrationDetail(id)
  if (!detail) notFound()

  const communicationHistory = await getTeacherCommunicationHistory(detail.teacherId)

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" render={<Link href="/training/admin/registrations" />} className="w-fit">
        <ArrowLeft /> Back to registrations
      </Button>
      <RegistrationDetailView detail={detail} startInEdit={edit === '1'} communicationHistory={communicationHistory} />
    </div>
  )
}
