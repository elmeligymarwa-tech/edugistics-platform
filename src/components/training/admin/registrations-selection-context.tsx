'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  clearedNotice: string | null
  dismissClearedNotice: () => void
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

/** The filter signature selection state keys off — everything except pagination and the flat/by-course view toggle. */
function computeFiltersKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString())
  params.delete('page')
  params.delete('view')
  return params.toString()
}

export function RegistrationsSelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const filtersKey = useMemo(() => computeFiltersKey(searchParams), [searchParams])

  const [state, setState] = useState<SelectionState>(Selection.EMPTY_SELECTION)
  const [includeWaitlisted, setIncludeWaitlistedState] = useState(false)
  const [clearedNotice, setClearedNotice] = useState<string | null>(null)
  const previousFiltersKey = useRef(filtersKey)

  useEffect(() => {
    if (previousFiltersKey.current === filtersKey) return
    previousFiltersKey.current = filtersKey
    setState((current) => {
      const next = Selection.clearSelectionIfFiltersChanged(current, filtersKey)
      if (next !== current) setClearedNotice('Selection cleared because filters changed.')
      return next
    })
  }, [filtersKey])

  const value: SelectionContextValue = {
    state,
    filtersKey,
    includeWaitlisted,
    setIncludeWaitlisted: (value) => {
      setIncludeWaitlistedState(value)
      // The pool of selectable rows just changed (waitlisted rows became eligible or ineligible) — a kept
      // selection could silently reference rows that are no longer valid, so start over instead.
      setState(Selection.EMPTY_SELECTION)
      setClearedNotice(null)
    },
    toggleRow: (id, selectable) => setState((current) => Selection.toggleRow(current, id, filtersKey, selectable)),
    selectVisible: (ids) => setState((current) => Selection.selectVisible(current, ids, filtersKey)),
    deselectVisible: (ids) => setState((current) => Selection.deselectVisible(current, ids, filtersKey)),
    selectAllMatchingFilters: () => setState(() => Selection.selectAllMatchingFilters(filtersKey)),
    clearSelection: () => {
      setState(Selection.EMPTY_SELECTION)
      setClearedNotice(null)
    },
    isSelected: (id) => Selection.isRowSelected(state, id),
    areAllVisibleSelected: (ids) => Selection.areAllVisibleSelected(state, ids),
    clearedNotice,
    dismissClearedNotice: () => setClearedNotice(null),
  }

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

export function useRegistrationsSelection(): SelectionContextValue {
  const context = useContext(SelectionContext)
  if (!context) throw new Error('useRegistrationsSelection must be used within a RegistrationsSelectionProvider')
  return context
}
