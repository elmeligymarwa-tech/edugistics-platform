'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { SubscriberFilterOptions } from '@/lib/training/subscribers-admin'

const STATUS_OPTIONS = [
  { value: 'SUBSCRIBED', label: 'Subscribed' },
  { value: 'UNSUBSCRIBED', label: 'Unsubscribed' },
  { value: 'ALL', label: 'All' },
]

const SOURCE_OPTIONS = [
  { value: 'ALL', label: 'All sources' },
  { value: 'TRAINING_REGISTRATION', label: 'Training registration' },
  { value: 'ADMIN_MANUAL', label: 'Admin (manual)' },
  { value: 'MIGRATED', label: 'Migrated' },
]

const SORT_OPTIONS = [
  { value: 'subscribedAt:desc', label: 'Date subscribed (newest)' },
  { value: 'subscribedAt:asc', label: 'Date subscribed (oldest)' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'emailsSent:desc', label: 'Emails sent (most)' },
  { value: 'emailsSent:asc', label: 'Emails sent (least)' },
]

export function SubscribersFilters({ options }: { options: SubscriberFilterOptions }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  function updateParam(key: string, value: string | null, defaultValue = 'ALL') {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== defaultValue) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (search === current) return
    const timeout = setTimeout(() => updateParam('q', search || null), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const schoolItems = [{ value: 'ALL', label: 'All schools' }, ...options.schools.map((school) => ({ value: school.id, label: school.name }))]
  const subjectItems = [{ value: 'ALL', label: 'All subjects' }, ...options.subjects.map((subject) => ({ value: subject.value, label: subject.label }))]
  const gradeItems = [{ value: 'ALL', label: 'All grades' }, ...options.grades.map((grade) => ({ value: grade.value, label: grade.label }))]
  const courseItems = [{ value: 'ALL', label: 'All courses' }, ...options.courses.map((course) => ({ value: course.id, label: course.name }))]

  const currentSort = `${searchParams.get('sortField') ?? 'subscribedAt'}:${searchParams.get('sortDir') ?? 'desc'}`

  function updateSort(value: string) {
    const [sortField, sortDir] = value.split(':')
    const params = new URLSearchParams(searchParams.toString())
    params.set('sortField', sortField!)
    params.set('sortDir', sortDir!)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const exportParams = new URLSearchParams(searchParams.toString())
  exportParams.delete('page')

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="subscribers-search">
          Search
        </label>
        <Input
          id="subscribers-search"
          placeholder="Name, email or school"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-56"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Status</span>
        <Select
          items={STATUS_OPTIONS}
          value={searchParams.get('status') ?? 'SUBSCRIBED'}
          onValueChange={(value) => updateParam('status', value, 'SUBSCRIBED')}
          triggerClassName="w-36"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">School</span>
        <Select items={schoolItems} value={searchParams.get('schoolId') ?? 'ALL'} onValueChange={(value) => updateParam('schoolId', value)} triggerClassName="w-48" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Subject</span>
        <Select items={subjectItems} value={searchParams.get('subject') ?? 'ALL'} onValueChange={(value) => updateParam('subject', value)} triggerClassName="w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Grade</span>
        <Select items={gradeItems} value={searchParams.get('grade') ?? 'ALL'} onValueChange={(value) => updateParam('grade', value)} triggerClassName="w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Course subscribed from</span>
        <Select items={courseItems} value={searchParams.get('courseId') ?? 'ALL'} onValueChange={(value) => updateParam('courseId', value)} triggerClassName="w-48" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Source</span>
        <Select items={SOURCE_OPTIONS} value={searchParams.get('source') ?? 'ALL'} onValueChange={(value) => updateParam('source', value)} triggerClassName="w-44" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="subscribers-from">
          Subscribed from
        </label>
        <Input
          id="subscribers-from"
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(event) => updateParam('from', event.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="subscribers-to">
          Subscribed to
        </label>
        <Input
          id="subscribers-to"
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(event) => updateParam('to', event.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Sort by</span>
        <Select items={SORT_OPTIONS} value={currentSort} onValueChange={updateSort} triggerClassName="w-56" />
      </div>
      <Button variant="outline" render={<a href={`/api/training/admin/subscribers/export?${exportParams.toString()}`} />}>
        <Download /> Export Subscribers
      </Button>
    </div>
  )
}
