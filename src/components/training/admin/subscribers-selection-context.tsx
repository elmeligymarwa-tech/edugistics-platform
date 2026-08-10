'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  clearedNotice: string | null
}

const SubscribersSelectionContext = createContext<SubscribersSelectionContextValue | null>(null)

/** The filter signature selection state keys off — everything except pagination. Reuses the same generic selection state machine the registrations page uses (src/domain/training/registration-selection.ts), which has no Registration-specific coupling. */
function computeFiltersKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString())
  params.delete('page')
  return params.toString()
}

export function SubscribersSelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const filtersKey = useMemo(() => computeFiltersKey(searchParams), [searchParams])

  const [state, setState] = useState<SelectionState>(Selection.EMPTY_SELECTION)
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

  const value: SubscribersSelectionContextValue = {
    state,
    filtersKey,
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
  }

  return <SubscribersSelectionContext.Provider value={value}>{children}</SubscribersSelectionContext.Provider>
}

export function useSubscribersSelection(): SubscribersSelectionContextValue {
  const context = useContext(SubscribersSelectionContext)
  if (!context) throw new Error('useSubscribersSelection must be used within a SubscribersSelectionProvider')
  return context
}
