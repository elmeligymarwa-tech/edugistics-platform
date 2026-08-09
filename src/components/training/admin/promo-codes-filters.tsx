'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { PROMO_CODE_STATUS_LABELS, PROMO_CODE_STATUSES } from '@/domain/training/promo-code'

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All statuses' },
  ...PROMO_CODE_STATUSES.map((status) => ({ value: status, label: PROMO_CODE_STATUS_LABELS[status] })),
]

const SORT_OPTIONS: SelectOption[] = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'expiresAt:asc', label: 'Expiry — soonest first' },
  { value: 'expiresAt:desc', label: 'Expiry — latest first' },
  { value: 'usage:desc', label: 'Most used' },
  { value: 'usage:asc', label: 'Least used' },
]

export function PromoCodesFilters() {
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

  const currentSort = `${searchParams.get('sortField') ?? 'createdAt'}:${searchParams.get('sortDir') ?? 'desc'}`

  function updateSort(value: string) {
    const [sortField, sortDir] = value.split(':')
    const params = new URLSearchParams(searchParams.toString())
    params.set('sortField', sortField!)
    params.set('sortDir', sortDir!)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="promo-codes-search">
          Search
        </label>
        <Input
          id="promo-codes-search"
          placeholder="Code or description"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-56"
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
        <span className="text-xs text-muted-foreground">Sort</span>
        <Select items={SORT_OPTIONS} value={currentSort} onValueChange={updateSort} triggerClassName="w-52" />
      </div>
    </div>
  )
}
