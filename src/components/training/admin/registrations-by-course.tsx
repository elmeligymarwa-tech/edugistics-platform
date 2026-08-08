'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { formatCourseDateLong } from '@/domain/training/format'
import type { RegistrationCourseGroup, RegistrationListItem } from '@/lib/training/registrations'
import { fetchCourseRegistrationsPageAction } from '@/app/training/admin/(protected)/registrations/actions'
import { RegistrationRowsTable, RegistrationsPaginationBar } from './registrations-table'

function CourseSection({ group, searchParams }: { group: RegistrationCourseGroup; searchParams: URLSearchParams }) {
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<RegistrationListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)

  async function loadPage(nextPage: number) {
    setLoading(true)
    const result = await fetchCourseRegistrationsPageAction(
      group.courseId,
      Object.fromEntries(searchParams.entries()),
      nextPage,
    )
    setRows(result.rows)
    setTotalCount(result.totalCount)
    setPage(nextPage)
    setLoading(false)
    setLoaded(true)
  }

  function toggle() {
    setExpanded((current) => !current)
    if (!loaded) void loadPage(0)
  }

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
      >
        <span className="flex items-center gap-2 font-medium text-heading">
          {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
          {group.courseName}
        </span>
        <span className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{formatCourseDateLong(group.courseDate)}</span>
          <span>{group.confirmedCount} confirmed</span>
          <span>{group.waitlistedCount} waitlisted</span>
          <span>Capacity: {group.capacity ?? 'Unlimited'}</span>
        </span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          {loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No registrations match these filters.</p>
          ) : (
            <>
              <RegistrationRowsTable rows={rows} />
              <RegistrationsPaginationBar totalCount={totalCount} page={page} onPageChange={loadPage} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function RegistrationsByCourse({ groups }: { groups: RegistrationCourseGroup[] }) {
  const searchParams = useSearchParams()
  const filtersKey = searchParams.toString()

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No registrations match these filters.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        // Keyed on the filters too, so a change in search/status/date range
        // resets each section's already-loaded page instead of showing a
        // stale one for a section left expanded.
        <CourseSection key={`${group.courseId}:${filtersKey}`} group={group} searchParams={searchParams} />
      ))}
    </div>
  )
}
