'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { isSelectionEmpty } from '@/domain/training/registration-selection'
import { getSubscriberSelectionSummaryAction } from '@/app/training/admin/(protected)/subscribers/actions'
import type { MarketingTemplateListItem } from '@/lib/training/marketing-templates'
import type { SubscriberCriteriaInput } from '@/lib/training/subscriber-criteria'
import { SubscribersEmailComposer } from './subscribers-email-composer'
import { useSubscribersSelection } from './subscribers-selection-context'

function criteriaFromFiltersKey(filtersKey: string, excludeIds: string[]): SubscriberCriteriaInput {
  return { mode: 'filters', searchParams: Object.fromEntries(new URLSearchParams(filtersKey)), excludeIds }
}

export function SubscribersSelectionBar({ templates }: { templates: MarketingTemplateListItem[] }) {
  const selection = useSubscribersSelection()
  const { state, filtersKey } = selection

  const [count, setCount] = useState<number | null>(null)
  const [filterTotal, setFilterTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)

  const criteria: SubscriberCriteriaInput | null = isSelectionEmpty(state)
    ? null
    : state.mode === 'ids'
      ? { mode: 'ids', subscriberIds: state.ids }
      : // mode 'all' — resolved from the filter snapshot it was captured under
        // (state.filtersKey), never from whatever filter is displayed right
        // now; those can differ once the admin navigates elsewhere without
        // losing the selection (defect 2).
        criteriaFromFiltersKey(state.filtersKey ?? filtersKey, state.excludedIds)

  useEffect(() => {
    if (!criteria) {
      setCount(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getSubscriberSelectionSummaryAction(criteria).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.success) setCount(result.data.count)
    })
    return () => {
      cancelled = true
    }
    // criteria is derived fresh each render from primitives already in the dependency array below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode, state.ids.join(','), state.excludedIds.join(','), state.filtersKey, filtersKey])

  useEffect(() => {
    let cancelled = false
    // Note: this always resolves to the subscribed-only count for the current filters —
    // resolveSubscriberSelection forces status = SUBSCRIBED regardless of the active status filter.
    getSubscriberSelectionSummaryAction(criteriaFromFiltersKey(filtersKey, [])).then((result) => {
      if (cancelled) return
      if (result.success) setFilterTotal(result.data.count)
    })
    return () => {
      cancelled = true
    }
  }, [filtersKey])

  if (isSelectionEmpty(state)) return null

  const countLabel = count == null ? 'Calculating…' : `${count} subscriber${count === 1 ? '' : 's'} selected`
  const canUpsell = state.mode === 'ids' && filterTotal != null && count != null && filterTotal > count

  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium text-heading">{loading && count == null ? 'Calculating…' : countLabel}</p>
          <Button type="button" variant="ghost" size="sm" onClick={selection.clearSelection}>
            Clear selection
          </Button>
        </div>
        <Button type="button" onClick={() => setComposerOpen(true)} disabled={!count}>
          Send Email
        </Button>
      </div>
      {canUpsell && filterTotal != null && (
        <p className="text-sm text-muted-foreground">
          Select all {filterTotal} subscribed contacts matching these filters —{' '}
          <button type="button" className="underline" onClick={selection.selectAllMatchingFilters}>
            select all matching filters
          </button>
          .
        </p>
      )}
      {state.mode === 'all' && (
        <p className="text-sm text-muted-foreground">
          Every subscribed contact matching the filters used when you selected all is selected — still true even if
          you&apos;ve since changed filters to look at something else.
        </p>
      )}

      {criteria && (
        <SubscribersEmailComposer open={composerOpen} onOpenChange={setComposerOpen} criteria={criteria} templates={templates} />
      )}
    </div>
  )
}
