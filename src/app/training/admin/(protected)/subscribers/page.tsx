import { Suspense } from 'react'
import type { Metadata } from 'next'

import { cairoDateTimeLocalToUtc } from '@/domain/training/timezone'
import { parseSubscriberSearchParams, parseSubscriberSort } from '@/domain/training/subscriber-filters'
import { getSubscriberGrowthTrend, getSubscriberKpis, type SubscriberDateRangeFilter } from '@/lib/training/subscriber-analytics'
import { listSubscriberFilterOptions, listSubscribersForAdmin } from '@/lib/training/subscribers-admin'
import { SubscriberGrowthChart } from '@/components/training/admin/subscriber-growth-chart'
import { SubscribersFilters } from '@/components/training/admin/subscribers-filters'
import { SubscribersKpiRow } from '@/components/training/admin/subscribers-kpi-row'
import { SubscribersSelectionBar } from '@/components/training/admin/subscribers-selection-bar'
import { SubscribersSelectionProvider } from '@/components/training/admin/subscribers-selection-context'
import { SubscribersTable } from '@/components/training/admin/subscribers-table'
import type { TrendGranularity } from '@/domain/training/analytics'

export const metadata: Metadata = {
  title: 'Subscribers — Edugistics Training Admin',
}

interface SubscribersSearchParams {
  [key: string]: string | undefined
  page?: string
  q?: string
  status?: string
  schoolId?: string
  subject?: string
  grade?: string
  from?: string
  to?: string
  courseId?: string
  source?: string
  sortField?: string
  sortDir?: string
  analyticsFrom?: string
  analyticsTo?: string
}

export default async function TrainingAdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<SubscribersSearchParams>
}) {
  const params = await searchParams
  const filters = parseSubscriberSearchParams(params)
  const { sortField, sortDir } = parseSubscriberSort(params)
  const page = Math.max(0, Number(params.page ?? '1') - 1)

  const analyticsRange: SubscriberDateRangeFilter = {
    dateFrom: params.analyticsFrom ? cairoDateTimeLocalToUtc(`${params.analyticsFrom}T00:00`) : undefined,
    dateTo: params.analyticsTo ? cairoDateTimeLocalToUtc(`${params.analyticsTo}T23:59`) : undefined,
  }

  const [{ rows, totalCount }, options, kpis, trendDay, trendWeek, trendMonth] = await Promise.all([
    listSubscribersForAdmin(filters, page, sortField, sortDir),
    listSubscriberFilterOptions(),
    getSubscriberKpis(analyticsRange),
    getSubscriberGrowthTrend(analyticsRange, 'DAY'),
    getSubscriberGrowthTrend(analyticsRange, 'WEEK'),
    getSubscriberGrowthTrend(analyticsRange, 'MONTH'),
  ])

  const trends: Record<TrendGranularity, Awaited<ReturnType<typeof getSubscriberGrowthTrend>>> = {
    DAY: trendDay,
    WEEK: trendWeek,
    MONTH: trendMonth,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-heading">Subscribers</h1>
        <p className="mt-1 text-sm text-muted-foreground">The mailing list — sourced entirely from Subscriber.status, never the legacy consent flag.</p>
      </div>

      <SubscribersKpiRow kpis={kpis} />
      <SubscriberGrowthChart trends={trends} />

      <Suspense>
        <SubscribersSelectionProvider>
          <SubscribersFilters options={options} />
          <p className="text-sm font-medium text-heading">
            {totalCount} subscriber{totalCount === 1 ? '' : 's'}
          </p>
          <SubscribersTable rows={rows} totalCount={totalCount} page={page} />
          <SubscribersSelectionBar />
        </SubscribersSelectionProvider>
      </Suspense>
    </div>
  )
}
