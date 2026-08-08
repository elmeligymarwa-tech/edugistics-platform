'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { CourseFilterOption } from '@/lib/training/registrations'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const EMAIL_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All email statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
]

const CONSENT_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'true', label: 'Consented' },
  { value: 'false', label: 'Not consented' },
]

export function RegistrationsFilters({ courseOptions }: { courseOptions: CourseFilterOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'ALL') params.set(key, value)
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

  const courseItems = [
    { value: 'ALL', label: 'All courses' },
    ...courseOptions.map((course) => ({ value: course.id, label: course.name })),
  ]

  const exportParams = new URLSearchParams(searchParams.toString())
  exportParams.delete('page')

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="registrations-search">
          Search
        </label>
        <Input
          id="registrations-search"
          placeholder="Name, email, school or reference"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Course</span>
        <Select
          items={courseItems}
          value={searchParams.get('courseId') ?? 'ALL'}
          onValueChange={(value) => updateParam('courseId', value)}
          triggerClassName="w-48"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Status</span>
        <Select
          items={STATUS_OPTIONS}
          value={searchParams.get('status') ?? 'ALL'}
          onValueChange={(value) => updateParam('status', value)}
          triggerClassName="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Email status</span>
        <Select
          items={EMAIL_STATUS_OPTIONS}
          value={searchParams.get('emailStatus') ?? 'ALL'}
          onValueChange={(value) => updateParam('emailStatus', value)}
          triggerClassName="w-44"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Marketing consent</span>
        <Select
          items={CONSENT_OPTIONS}
          value={searchParams.get('consent') ?? 'ALL'}
          onValueChange={(value) => updateParam('consent', value)}
          triggerClassName="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="registrations-from">
          From
        </label>
        <Input
          id="registrations-from"
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(event) => updateParam('from', event.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="registrations-to">
          To
        </label>
        <Input
          id="registrations-to"
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(event) => updateParam('to', event.target.value || null)}
          className="w-40"
        />
      </div>
      <Button
        variant="outline"
        render={<a href={`/api/training/admin/registrations/export?${exportParams.toString()}`} />}
      >
        <Download /> Export to Excel
      </Button>
    </div>
  )
}
