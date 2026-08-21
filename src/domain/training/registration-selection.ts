/**
 * Pure state machine for a checkbox-based recipient selection, shared by
 * the registrations screen and the subscribers screen (see
 * registrations-selection-context.tsx and subscribers-selection-context.tsx
 * — same module, no Registration-specific coupling). Framework-agnostic (no
 * React) so the transition rules can be unit tested directly.
 *
 * mode 'ids': an explicit set of selected ids, tracked purely by id. Never
 * invalidated by a filter change — an id, once selected, stays selected
 * regardless of what filter is currently displayed (defect 2: selecting
 * some rows and then switching filters used to silently discard the whole
 * selection; ids are globally meaningful, so there was never a correctness
 * reason to do that — only a defensive one, and the defensiveness cost more
 * than it protected).
 *
 * mode 'all': every row matching one specific filter snapshot (filtersKey)
 * is selected, except any id explicitly removed into excludedIds — this is
 * how "select all matching filters" is represented without ever loading
 * every matching row into the browser. Unlike 'ids', this genuinely can't
 * survive a filter change with its meaning intact: "all" is only
 * well-defined relative to the filter snapshot it was captured under, so
 * toggling a row visible under a *different* filter is a no-op rather than
 * silently reinterpreting what "all" refers to — see toggleRow.
 */
export interface SelectionState {
  mode: 'none' | 'ids' | 'all'
  ids: string[]
  excludedIds: string[]
  filtersKey: string | null
}

export const EMPTY_SELECTION: SelectionState = { mode: 'none', ids: [], excludedIds: [], filtersKey: null }

/** Toggles one row. Never selects a row the caller marks unselectable (cancelled, or waitlisted while excluded). */
export function toggleRow(state: SelectionState, id: string, filtersKey: string, selectable: boolean): SelectionState {
  if (!selectable) return state

  if (state.mode === 'all') {
    // This row belongs to a different filter snapshot than the one "all"
    // covers — nothing to add or remove without redefining what "all"
    // means, so leave the selection untouched. Use "Clear selection" to
    // start over from here if that's what's wanted.
    if (state.filtersKey !== filtersKey) return state
    const excluded = new Set(state.excludedIds)
    if (excluded.has(id)) excluded.delete(id)
    else excluded.add(id)
    return { ...state, excludedIds: [...excluded] }
  }

  const ids = new Set(state.ids)
  if (ids.has(id)) ids.delete(id)
  else ids.add(id)
  return { mode: ids.size === 0 ? 'none' : 'ids', ids: [...ids], excludedIds: [], filtersKey: null }
}

/**
 * Selects every currently-visible selectable row (e.g. the current page, or
 * a course section's loaded rows). Unlike toggleRow/deselectVisible, this
 * never needs to know the current filtersKey: it only ever adds ids, and
 * 'all' mode already covers everything matching its own filter snapshot, so
 * there's nothing for it to do there regardless of what's on screen.
 */
export function selectVisible(state: SelectionState, visibleSelectableIds: string[]): SelectionState {
  if (state.mode === 'all') return state // already covers everything matching its own filter snapshot

  const ids = new Set(state.ids)
  for (const id of visibleSelectableIds) ids.add(id)
  return { mode: ids.size === 0 ? 'none' : 'ids', ids: [...ids], excludedIds: [], filtersKey: null }
}

/** Deselects every currently-visible row, without disturbing selections made outside this visible set. */
export function deselectVisible(state: SelectionState, visibleIds: string[], filtersKey: string): SelectionState {
  if (state.mode === 'all') {
    if (state.filtersKey !== filtersKey) return state // different filter snapshot — nothing in scope to deselect
    const excluded = new Set(state.excludedIds)
    for (const id of visibleIds) excluded.add(id)
    return { ...state, excludedIds: [...excluded] }
  }
  const ids = new Set(state.ids)
  for (const id of visibleIds) ids.delete(id)
  return { mode: ids.size === 0 ? 'none' : 'ids', ids: [...ids], excludedIds: [], filtersKey: null }
}

/** Switches to "every record matching these filters" — resolved server-side at send time, never enumerated client-side. */
export function selectAllMatchingFilters(filtersKey: string): SelectionState {
  return { mode: 'all', ids: [], excludedIds: [], filtersKey }
}

export function clearSelection(): SelectionState {
  return EMPTY_SELECTION
}

/**
 * `filtersKey` is the filter set currently on screen. For mode 'ids' it's
 * irrelevant — an id is selected or it isn't, regardless of what's
 * currently displayed. For mode 'all' it matters: a row belongs to the
 * "all" selection only if it was resolved under the exact filter snapshot
 * "all" was captured under, so a row visible under a *different* filter
 * (the admin has since navigated elsewhere) is correctly reported as not
 * selected, even though it isn't in excludedIds either.
 */
export function isRowSelected(state: SelectionState, id: string, filtersKey: string): boolean {
  if (state.mode === 'ids') return state.ids.includes(id)
  if (state.mode === 'all') {
    if (state.filtersKey !== filtersKey) return false
    return !state.excludedIds.includes(id)
  }
  return false
}

export function areAllVisibleSelected(state: SelectionState, visibleSelectableIds: string[], filtersKey: string): boolean {
  if (visibleSelectableIds.length === 0) return false
  if (state.mode === 'all') {
    if (state.filtersKey !== filtersKey) return false
    return visibleSelectableIds.every((id) => !state.excludedIds.includes(id))
  }
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
