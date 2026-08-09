import { Suspense } from 'react'
import type { Metadata } from 'next'

import { listCourseFilterOptions } from '@/lib/training/registrations'
import { listPromoCodesForAdmin, parsePromoCodeSearchParams } from '@/lib/training/promo-codes'
import { PromoCodeFormDialog } from '@/components/training/admin/promo-code-form-dialog'
import { PromoCodesFilters } from '@/components/training/admin/promo-codes-filters'
import { PromoCodesTable } from '@/components/training/admin/promo-codes-table'

export const metadata: Metadata = {
  title: 'Promo Codes — Edugistics Training Admin',
}

interface PromoCodesSearchParams {
  [key: string]: string | undefined
  page?: string
  q?: string
  status?: string
  sortField?: string
  sortDir?: string
}

export default async function TrainingAdminPromoCodesPage({ searchParams }: { searchParams: Promise<PromoCodesSearchParams> }) {
  const params = await searchParams
  const { filters, sortField, sortDir } = parsePromoCodeSearchParams(params)
  const page = Math.max(0, Number(params.page ?? '1') - 1)

  const [{ rows, totalCount }, courses] = await Promise.all([
    listPromoCodesForAdmin(filters, page, sortField, sortDir),
    listCourseFilterOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-heading">Promo Codes</h1>
        <PromoCodeFormDialog courses={courses} />
      </div>
      <Suspense>
        <PromoCodesFilters />
        <PromoCodesTable rows={rows} totalCount={totalCount} page={page} courses={courses} />
      </Suspense>
    </div>
  )
}
