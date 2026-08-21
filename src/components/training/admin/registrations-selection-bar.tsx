'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { isSelectionEmpty } from '@/domain/training/registration-selection'
import { getRecipientSummaryAction, type RecipientSummary } from '@/app/training/admin/(protected)/registrations/email-actions'
import type { RecipientCriteriaInput } from '@/lib/training/email/criteria'
import { SendEmailComposer } from './send-email-composer'
import { useRegistrationsSelection } from './registrations-selection-context'

function criteriaFromFiltersKey(filtersKey: string, excludeIds: string[], includeWaitlisted: boolean): RecipientCriteriaInput {
  return {
    mode: 'filters',
    searchParams: Object.fromEntries(new URLSearchParams(filtersKey)),
    excludeIds,
    includeWaitlisted,
  }
}

export function RegistrationsSelectionBar() {
  const selection = useRegistrationsSelection()
  const { state, filtersKey, includeWaitlisted } = selection

  const [selectionSummary, setSelectionSummary] = useState<RecipientSummary | null>(null)
  const [filterTotal, setFilterTotal] = useState<RecipientSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)

  const criteria: RecipientCriteriaInput | null = isSelectionEmpty(state)
    ? null
    : state.mode === 'ids'
      ? { mode: 'ids', registrationIds: state.ids, includeWaitlisted }
      : // mode 'all' — always resolved from the filter snapshot it was captured
        // under (state.filtersKey), never from whatever filter happens to be
        // displayed right now; those can differ once the admin navigates
        // elsewhere without losing the selection (defect 2).
        criteriaFromFiltersKey(state.filtersKey ?? filtersKey, state.excludedIds, includeWaitlisted)

  useEffect(() => {
    if (!criteria) {
      setSelectionSummary(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getRecipientSummaryAction(criteria).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.success) setSelectionSummary(result.data)
    })
    return () => {
      cancelled = true
    }
    // criteria is derived fresh each render from primitives already in the dependency array below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode, state.ids.join(','), state.excludedIds.join(','), state.filtersKey, filtersKey, includeWaitlisted])

  useEffect(() => {
    let cancelled = false
    getRecipientSummaryAction(criteriaFromFiltersKey(filtersKey, [], includeWaitlisted)).then((result) => {
      if (cancelled) return
      if (result.success) setFilterTotal(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [filtersKey, includeWaitlisted])

  if (isSelectionEmpty(state)) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={includeWaitlisted}
            onCheckedChange={() => selection.setIncludeWaitlisted(!includeWaitlisted)}
          />
          Include waitlisted registrants
        </label>
        {includeWaitlisted && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
            Waitlisted teachers do not hold a place and should not normally receive a joining link.
          </p>
        )}
      </div>
    )
  }

  const countLabel = selectionSummary
    ? selectionSummary.rawRegistrationCount === selectionSummary.uniqueTeacherCount
      ? `${selectionSummary.uniqueTeacherCount} teacher${selectionSummary.uniqueTeacherCount === 1 ? '' : 's'} selected`
      : `${selectionSummary.rawRegistrationCount} registrations, ${selectionSummary.uniqueTeacherCount} unique teachers selected`
    : 'Calculating…'

  const canUpsell =
    state.mode === 'ids' &&
    filterTotal &&
    selectionSummary &&
    filterTotal.uniqueTeacherCount > selectionSummary.uniqueTeacherCount

  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium text-heading">{loading && !selectionSummary ? 'Calculating…' : countLabel}</p>
          <Button type="button" variant="ghost" size="sm" onClick={selection.clearSelection}>
            Clear selection
          </Button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={includeWaitlisted}
              onCheckedChange={() => selection.setIncludeWaitlisted(!includeWaitlisted)}
            />
            Include waitlisted registrants
          </label>
        </div>
        <Button type="button" onClick={() => setComposerOpen(true)} disabled={!selectionSummary || selectionSummary.uniqueTeacherCount === 0}>
          Send Email
        </Button>
      </div>
      {includeWaitlisted && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Waitlisted teachers do not hold a place and should not normally receive a joining link.
        </p>
      )}
      {canUpsell && filterTotal && (
        <p className="text-sm text-muted-foreground">
          Select all {filterTotal.uniqueTeacherCount} unique teachers matching these filters —{' '}
          <button type="button" className="underline" onClick={selection.selectAllMatchingFilters}>
            select all matching filters
          </button>
          .
        </p>
      )}
      {state.mode === 'all' && (
        <p className="text-sm text-muted-foreground">
          Every record matching the filters used when you selected all is selected — still true even if you&apos;ve
          since changed filters or tabs to look at something else.
        </p>
      )}

      {criteria && selectionSummary && (
        <SendEmailComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          criteria={criteria}
          initialSummary={selectionSummary}
        />
      )}
    </div>
  )
}
