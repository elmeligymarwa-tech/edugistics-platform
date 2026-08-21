'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

import * as Selection from '@/domain/training/registration-selection'
import type { SelectionState } from '@/domain/training/registration-selection'

interface SelectionContextValue {
  state: SelectionState
  filtersKey: string
  includeWaitlisted: boolean
  setIncludeWaitlisted: (value: boolean) => void
  toggleRow: (id: string, selectable: boolean) => void
  selectVisible: (ids: string[]) => void
  deselectVisible: (ids: string[]) => void
  selectAllMatchingFilters: () => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
  areAllVisibleSelected: (ids: string[]) => boolean
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

/** The filter signature selection state keys off — everything except pagination and the flat/by-course view toggle. */
function computeFiltersKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString())
  params.delete('page')
  params.delete('view')
  return params.toString()
}

/**
 * Selections persist across filter, tab and "include waitlisted" changes
 * (defect 2) — nothing here resets `state` when `filtersKey` changes
 * anymore. An 'ids'-mode selection is just a set of ids, correct regardless
 * of what filter produced them; an 'all'-mode selection stays scoped to the
 * filter snapshot it was captured under (see registration-selection.ts) and
 * is resolved server-side from that snapshot, not from whatever filter
 * happens to be on screen right now. "Clear selection" (always visible
 * alongside the running total in RegistrationsSelectionBar) is the way out
 * if a kept selection isn't what's wanted.
 */
export function RegistrationsSelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const filtersKey = useMemo(() => computeFiltersKey(searchParams), [searchParams])

  const [state, setState] = useState<SelectionState>(Selection.EMPTY_SELECTION)
  const [includeWaitlisted, setIncludeWaitlistedState] = useState(false)

  const value: SelectionContextValue = {
    state,
    filtersKey,
    includeWaitlisted,
    setIncludeWaitlisted: setIncludeWaitlistedState,
    toggleRow: (id, selectable) => setState((current) => Selection.toggleRow(current, id, filtersKey, selectable)),
    selectVisible: (ids) => setState((current) => Selection.selectVisible(current, ids)),
    deselectVisible: (ids) => setState((current) => Selection.deselectVisible(current, ids, filtersKey)),
    selectAllMatchingFilters: () => setState(() => Selection.selectAllMatchingFilters(filtersKey)),
    clearSelection: () => setState(Selection.EMPTY_SELECTION),
    isSelected: (id) => Selection.isRowSelected(state, id, filtersKey),
    areAllVisibleSelected: (ids) => Selection.areAllVisibleSelected(state, ids, filtersKey),
  }

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

export function useRegistrationsSelection(): SelectionContextValue {
  const context = useContext(SelectionContext)
  if (!context) throw new Error('useRegistrationsSelection must be used within a RegistrationsSelectionProvider')
  return context
}
