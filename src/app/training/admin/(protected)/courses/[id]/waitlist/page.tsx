import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/ui/stat-tile'
import { getWaitlistPageData } from '@/lib/training/waitlist'
import { WaitlistTable } from '@/components/training/admin/waitlist-table'

export const metadata: Metadata = {
  title: 'Waitlist — Edugistics Training Admin',
}

export default async function TrainingAdminWaitlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getWaitlistPageData(id)
  if (!data) notFound()

  const hasAvailableSeats = data.remainingSeats != null && data.remainingSeats > 0 && data.waitlist.length > 0

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" render={<Link href="/training/admin/courses" />} className="w-fit">
        <ArrowLeft /> Back to courses
      </Button>

      <div>
        <h1 className="text-2xl font-medium text-heading">Waitlist — {data.courseName}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Confirmed" value={data.confirmedCount} />
        <StatTile label="Capacity" value={data.maxCapacity ?? 'Unlimited'} />
        <StatTile label="Remaining seats" value={data.remainingSeats ?? 'Unlimited'} />
        <StatTile label="Waiting" value={data.waitlist.length} />
      </div>

      {hasAvailableSeats && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          {data.remainingSeats} place{data.remainingSeats === 1 ? '' : 's'} available — promote a waitlisted teacher
          below. Nothing is confirmed automatically.
        </div>
      )}

      <WaitlistTable rows={data.waitlist} />
    </div>
  )
}
