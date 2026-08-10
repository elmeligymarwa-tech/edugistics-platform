'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'

export function MarketingCampaignsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="marketing-campaigns-from">
          From
        </label>
        <Input
          id="marketing-campaigns-from"
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(event) => updateParam('from', event.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="marketing-campaigns-to">
          To
        </label>
        <Input
          id="marketing-campaigns-to"
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(event) => updateParam('to', event.target.value || null)}
          className="w-40"
        />
      </div>
    </div>
  )
}
