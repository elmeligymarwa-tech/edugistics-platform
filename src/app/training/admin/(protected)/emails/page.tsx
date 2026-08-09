import { Suspense } from 'react'
import type { Metadata } from 'next'

import { parseCampaignSearchParams } from '@/domain/training/campaign-filters'
import { getCampaignFilterOptions, getCommunicationSummary, listCampaignsForAdmin } from '@/lib/training/email/campaign-analytics'
import { CampaignsTable } from '@/components/training/admin/campaigns-table'
import { CommunicationSummaryPanel } from '@/components/training/admin/communication-summary-panel'
import { EmailsFilters } from '@/components/training/admin/emails-filters'

export const metadata: Metadata = {
  title: 'Emails — Edugistics Training Admin',
}

interface EmailsSearchParams {
  [key: string]: string | undefined
  page?: string
  courseId?: string
  emailType?: string
  from?: string
  to?: string
}

export default async function TrainingAdminEmailsPage({ searchParams }: { searchParams: Promise<EmailsSearchParams> }) {
  const params = await searchParams
  const filters = parseCampaignSearchParams(params)
  const page = Math.max(0, Number(params.page ?? '1') - 1)

  const [{ rows, totalCount }, summary, filterOptions] = await Promise.all([
    listCampaignsForAdmin(filters, page),
    getCommunicationSummary(filters),
    getCampaignFilterOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-heading">Emails</h1>
      <CommunicationSummaryPanel summary={summary} />
      <Suspense>
        <EmailsFilters filterOptions={filterOptions} />
        <CampaignsTable rows={rows} totalCount={totalCount} page={page} />
      </Suspense>
    </div>
  )
}
