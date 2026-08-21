'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

import * as Selection from '@/domain/training/registration-selection'
import type { SelectionState } from '@/domain/training/registration-selection'

interface SubscribersSelectionContextValue {
  state: SelectionState
  filtersKey: string
  toggleRow: (id: string, selectable: boolean) => void
  selectVisible: (ids: string[]) => void
  deselectVisible: (ids: string[]) => void
  selectAllMatchingFilters: () => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
  areAllVisibleSelected: (ids: string[]) => boolean
}

const SubscribersSelectionContext = createContext<SubscribersSelectionContextValue | null>(null)

/** The filter signature selection state keys off — everything except pagination. Reuses the same generic selection state machine the registrations page uses (src/domain/training/registration-selection.ts), which has no Registration-specific coupling. */
function computeFiltersKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString())
  params.delete('page')
  return params.toString()
}

/**
 * Selections persist across filter and tab changes (defect 2) — nothing
 * here resets `state` when `filtersKey` changes. See
 * registrations-selection-context.tsx (the same fix, same reasoning) and
 * registration-selection.ts for why an 'ids'-mode selection never needed to
 * be invalidated by a filter change in the first place.
 */
export function SubscribersSelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const filtersKey = useMemo(() => computeFiltersKey(searchParams), [searchParams])

  const [state, setState] = useState<SelectionState>(Selection.EMPTY_SELECTION)

  const value: SubscribersSelectionContextValue = {
    state,
    filtersKey,
    toggleRow: (id, selectable) => setState((current) => Selection.toggleRow(current, id, filtersKey, selectable)),
    selectVisible: (ids) => setState((current) => Selection.selectVisible(current, ids)),
    deselectVisible: (ids) => setState((current) => Selection.deselectVisible(current, ids, filtersKey)),
    selectAllMatchingFilters: () => setState(() => Selection.selectAllMatchingFilters(filtersKey)),
    clearSelection: () => setState(Selection.EMPTY_SELECTION),
    isSelected: (id) => Selection.isRowSelected(state, id, filtersKey),
    areAllVisibleSelected: (ids) => Selection.areAllVisibleSelected(state, ids, filtersKey),
  }

  return <SubscribersSelectionContext.Provider value={value}>{children}</SubscribersSelectionContext.Provider>
}

export function useSubscribersSelection(): SubscribersSelectionContextValue {
  const context = useContext(SubscribersSelectionContext)
  if (!context) throw new Error('useSubscribersSelection must be used within a SubscribersSelectionProvider')
  return context
}
