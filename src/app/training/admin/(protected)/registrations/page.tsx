import { Suspense } from 'react'
import type { Metadata } from 'next'

import { listCourseFilterOptions, listRegistrationsForAdmin, parseRegistrationSearchParams } from '@/lib/training/registrations'
import { RegistrationsFilters } from '@/components/training/admin/registrations-filters'
import { RegistrationsTable } from '@/components/training/admin/registrations-table'

export const metadata: Metadata = {
  title: 'Registrations — Edugistics Training Admin',
}

interface RegistrationsSearchParams {
  [key: string]: string | undefined
  page?: string
  q?: string
  courseId?: string
  status?: string
  emailStatus?: string
  from?: string
  to?: string
}

export default async function TrainingAdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<RegistrationsSearchParams>
}) {
  const params = await searchParams
  const filters = parseRegistrationSearchParams(params)
  const page = Math.max(0, Number(params.page ?? '1') - 1)

  const [{ rows, totalCount }, courseOptions] = await Promise.all([
    listRegistrationsForAdmin(filters, page),
    listCourseFilterOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-heading">Registrations</h1>
      <Suspense>
        <RegistrationsFilters courseOptions={courseOptions} />
        <RegistrationsTable rows={rows} totalCount={totalCount} page={page} />
      </Suspense>
    </div>
  )
}
