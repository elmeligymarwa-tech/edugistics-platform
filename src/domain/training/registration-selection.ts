/**
 * Pure state machine for the registrations bulk-email checkbox selection.
 * Framework-agnostic (no React) so the transition rules can be unit tested
 * directly. The UI layer (registrations-selection-context.tsx) is a thin
 * wrapper that persists this state in React and clears it when the active
 * filter set changes.
 *
 * mode 'ids': an explicit set of selected registration ids.
 * mode 'all': every registration matching filtersKey is selected, except
 * any id explicitly removed into excludedIds — this is how "select all
 * matching filters" is represented without ever loading every matching row
 * into the browser.
 */
export interface SelectionState {
  mode: 'none' | 'ids' | 'all'
  ids: string[]
  excludedIds: string[]
  filtersKey: string | null
}

export const EMPTY_SELECTION: SelectionState = { mode: 'none', ids: [], excludedIds: [], filtersKey: null }

function resetIfDifferentFilters(state: SelectionState, filtersKey: string): SelectionState {
  if (state.filtersKey !== null && state.filtersKey !== filtersKey) return EMPTY_SELECTION
  return state
}

/** Toggles one row. Never selects a row the caller marks unselectable (cancelled, or waitlisted while excluded). */
export function toggleRow(state: SelectionState, id: string, filtersKey: string, selectable: boolean): SelectionState {
  if (!selectable) return state
  const current = resetIfDifferentFilters(state, filtersKey)

  if (current.mode === 'all') {
    const excluded = new Set(current.excludedIds)
    if (excluded.has(id)) excluded.delete(id)
    else excluded.add(id)
    return { ...current, excludedIds: [...excluded], filtersKey }
  }

  const ids = new Set(current.ids)
  if (ids.has(id)) ids.delete(id)
  else ids.add(id)
  return { mode: ids.size === 0 ? 'none' : 'ids', ids: [...ids], excludedIds: [], filtersKey: ids.size === 0 ? null : filtersKey }
}

/** Selects every currently-visible selectable row (e.g. the current page, or a course section's loaded rows). */
export function selectVisible(state: SelectionState, visibleSelectableIds: string[], filtersKey: string): SelectionState {
  const current = resetIfDifferentFilters(state, filtersKey)
  if (current.mode === 'all') return current

  const ids = new Set(current.ids)
  for (const id of visibleSelectableIds) ids.add(id)
  return { mode: ids.size === 0 ? 'none' : 'ids', ids: [...ids], excludedIds: [], filtersKey: ids.size === 0 ? null : filtersKey }
}

/** Deselects every currently-visible row, without disturbing selections made outside this visible set. */
export function deselectVisible(state: SelectionState, visibleIds: string[], filtersKey: string): SelectionState {
  const current = resetIfDifferentFilters(state, filtersKey)
  if (current.mode === 'all') {
    const excluded = new Set(current.excludedIds)
    for (const id of visibleIds) excluded.add(id)
    return { ...current, excludedIds: [...excluded], filtersKey }
  }
  const ids = new Set(current.ids)
  for (const id of visibleIds) ids.delete(id)
  return { mode: ids.size === 0 ? 'none' : 'ids', ids: [...ids], excludedIds: [], filtersKey: ids.size === 0 ? null : filtersKey }
}

/** Switches to "every record matching these filters" — resolved server-side at send time, never enumerated client-side. */
export function selectAllMatchingFilters(filtersKey: string): SelectionState {
  return { mode: 'all', ids: [], excludedIds: [], filtersKey }
}

export function clearSelection(): SelectionState {
  return EMPTY_SELECTION
}

/** Called whenever the active filter set changes. A stale selection from a different filter set is always dropped, never silently kept. */
export function clearSelectionIfFiltersChanged(state: SelectionState, filtersKey: string): SelectionState {
  if (state.mode === 'none') return state
  if (state.filtersKey === filtersKey) return state
  return EMPTY_SELECTION
}

export function isRowSelected(state: SelectionState, id: string): boolean {
  if (state.mode === 'ids') return state.ids.includes(id)
  if (state.mode === 'all') return !state.excludedIds.includes(id)
  return false
}

export function areAllVisibleSelected(state: SelectionState, visibleSelectableIds: string[]): boolean {
  if (visibleSelectableIds.length === 0) return false
  if (state.mode === 'all') return visibleSelectableIds.every((id) => !state.excludedIds.includes(id))
  if (state.mode === 'ids') return visibleSelectableIds.every((id) => state.ids.includes(id))
  return false
}

/** Cancelled registrations can never be selected. Waitlisted ones are selectable only when the admin has explicitly opted in. */
export function isRegistrationSelectable(
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED',
  includeWaitlisted: boolean,
): boolean {
  if (status === 'CANCELLED') return false
  if (status === 'WAITLISTED') return includeWaitlisted
  return true
}

export function isSelectionEmpty(state: SelectionState): boolean {
  if (state.mode === 'none') return true
  if (state.mode === 'ids') return state.ids.length === 0
  return false // mode 'all' is never empty — it represents at least the filtered set
}
