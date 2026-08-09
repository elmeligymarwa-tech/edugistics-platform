'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CAMPAIGN_EMAIL_TYPE_LABELS, CampaignEmailType } from '@/domain/training/schema'
import type { CampaignFilterOptions } from '@/lib/training/email/campaign-analytics'

const EMAIL_TYPE_OPTIONS = [
  { value: 'ALL', label: 'All types' },
  ...CampaignEmailType.options.map((value) => ({ value, label: CAMPAIGN_EMAIL_TYPE_LABELS[value] })),
]

export function EmailsFilters({ filterOptions }: { filterOptions: CampaignFilterOptions }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'ALL') params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const courseItems = [
    { value: 'ALL', label: 'All courses' },
    ...filterOptions.courses.map((course) => ({ value: course.id, label: course.name })),
  ]

  return (
    <div className="flex flex-wrap items-end gap-3">
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
        <span className="text-xs text-muted-foreground">Email type</span>
        <Select
          items={EMAIL_TYPE_OPTIONS}
          value={searchParams.get('emailType') ?? 'ALL'}
          onValueChange={(value) => updateParam('emailType', value)}
          triggerClassName="w-44"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="emails-from">
          From
        </label>
        <Input
          id="emails-from"
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(event) => updateParam('from', event.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="emails-to">
          To
        </label>
        <Input
          id="emails-to"
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(event) => updateParam('to', event.target.value || null)}
          className="w-40"
        />
      </div>
    </div>
  )
}
