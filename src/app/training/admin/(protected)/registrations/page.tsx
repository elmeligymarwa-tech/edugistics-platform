import { Suspense } from 'react'
import type { Metadata } from 'next'

import {
  listCourseFilterOptions,
  listRegistrationCourseGroups,
  listRegistrationsForAdmin,
  parseRegistrationSearchParams,
} from '@/lib/training/registrations'
import { RegistrationsByCourse } from '@/components/training/admin/registrations-by-course'
import { RegistrationsFilters } from '@/components/training/admin/registrations-filters'
import { RegistrationsTable } from '@/components/training/admin/registrations-table'
import { RegistrationsViewToggle, type RegistrationsView } from '@/components/training/admin/registrations-view-toggle'

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
  consent?: string
  from?: string
  to?: string
  view?: string
}

export default async function TrainingAdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<RegistrationsSearchParams>
}) {
  const params = await searchParams
  const filters = parseRegistrationSearchParams(params)
  const page = Math.max(0, Number(params.page ?? '1') - 1)
  const view: RegistrationsView = params.view === 'course' ? 'course' : 'all'

  const [tableData, groups, courseOptions] = await Promise.all([
    view === 'all' ? listRegistrationsForAdmin(filters, page) : Promise.resolve(null),
    view === 'course' ? listRegistrationCourseGroups(filters) : Promise.resolve(null),
    listCourseFilterOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-heading">Registrations</h1>
      <Suspense>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <RegistrationsFilters courseOptions={courseOptions} />
          <RegistrationsViewToggle view={view} />
        </div>
        {view === 'all' && tableData ? (
          <RegistrationsTable rows={tableData.rows} totalCount={tableData.totalCount} page={page} />
        ) : (
          <RegistrationsByCourse groups={groups ?? []} />
        )}
      </Suspense>
    </div>
  )
}
