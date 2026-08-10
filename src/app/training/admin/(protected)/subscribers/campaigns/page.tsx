import { Suspense } from 'react'
import type { Metadata } from 'next'

import { parseMarketingCampaignSearchParams } from '@/domain/training/marketing-campaign-filters'
import { listMarketingCampaignsForAdmin } from '@/lib/training/email/marketing-campaign-analytics'
import { MarketingCampaignsFilters } from '@/components/training/admin/marketing-campaigns-filters'
import { MarketingCampaignsTable } from '@/components/training/admin/marketing-campaigns-table'

export const metadata: Metadata = {
  title: 'Campaigns — Edugistics Training Admin',
}

interface CampaignsSearchParams {
  [key: string]: string | undefined
  page?: string
  from?: string
  to?: string
}

export default async function TrainingAdminMarketingCampaignsPage({ searchParams }: { searchParams: Promise<CampaignsSearchParams> }) {
  const params = await searchParams
  const filters = parseMarketingCampaignSearchParams(params)
  const page = Math.max(0, Number(params.page ?? '1') - 1)

  const { rows, totalCount } = await listMarketingCampaignsForAdmin(filters, page)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-heading">Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every marketing email sent to the mailing list, most recent first.</p>
      </div>
      <Suspense>
        <MarketingCampaignsFilters />
        <MarketingCampaignsTable rows={rows} totalCount={totalCount} page={page} />
      </Suspense>
    </div>
  )
}
