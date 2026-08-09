import { describe, expect, it } from 'vitest'

import {
  EMPTY_SELECTION,
  areAllVisibleSelected,
  clearSelectionIfFiltersChanged,
  isRegistrationSelectable,
  isRowSelected,
  selectAllMatchingFilters,
  selectVisible,
  toggleRow,
} from './registration-selection'

const FILTERS_A = 'status=CONFIRMED'
const FILTERS_B = 'status=CONFIRMED&courseId=abc'

describe('toggleRow', () => {
  it('selects an individual row', () => {
    const state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, true)
    expect(state.mode).toBe('ids')
    expect(isRowSelected(state, 'reg-1')).toBe(true)
  })

  it('never selects a row the caller marks unselectable', () => {
    const state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, false)
    expect(state).toEqual(EMPTY_SELECTION)
    expect(isRowSelected(state, 'reg-1')).toBe(false)
  })

  it('toggling twice deselects the row', () => {
    let state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, true)
    state = toggleRow(state, 'reg-1', FILTERS_A, true)
    expect(state.mode).toBe('none')
  })
})

describe('selectVisible', () => {
  it('selects every visible selectable row', () => {
    const state = selectVisible(EMPTY_SELECTION, ['reg-1', 'reg-2', 'reg-3'], FILTERS_A)
    expect(areAllVisibleSelected(state, ['reg-1', 'reg-2', 'reg-3'])).toBe(true)
  })

  it('selection persists across pagination within the same filter set', () => {
    // Page 1
    let state = selectVisible(EMPTY_SELECTION, ['reg-1', 'reg-2'], FILTERS_A)
    // Navigate to page 2 under the same filters — previous page's selection must survive.
    state = selectVisible(state, ['reg-3', 'reg-4'], FILTERS_A)
    expect(isRowSelected(state, 'reg-1')).toBe(true)
    expect(isRowSelected(state, 'reg-2')).toBe(true)
    expect(isRowSelected(state, 'reg-3')).toBe(true)
    expect(isRowSelected(state, 'reg-4')).toBe(true)
  })
})

describe('selectAllMatchingFilters', () => {
  it('selects every record for the given filters without enumerating ids', () => {
    const state = selectAllMatchingFilters(FILTERS_A)
    expect(state.mode).toBe('all')
    expect(isRowSelected(state, 'any-id-not-previously-seen')).toBe(true)
  })

  it('an id explicitly removed from an "all" selection is excluded', () => {
    let state = selectAllMatchingFilters(FILTERS_A)
    state = toggleRow(state, 'reg-5', FILTERS_A, true)
    expect(isRowSelected(state, 'reg-5')).toBe(false)
    expect(isRowSelected(state, 'reg-6')).toBe(true)
  })
})

describe('clearSelectionIfFiltersChanged', () => {
  it('clears a selection made under a different filter set', () => {
    const state = selectVisible(EMPTY_SELECTION, ['reg-1'], FILTERS_A)
    const cleared = clearSelectionIfFiltersChanged(state, FILTERS_B)
    expect(cleared.mode).toBe('none')
  })

  it('keeps the selection when the filter set is unchanged', () => {
    const state = selectVisible(EMPTY_SELECTION, ['reg-1'], FILTERS_A)
    const kept = clearSelectionIfFiltersChanged(state, FILTERS_A)
    expect(kept).toBe(state)
  })
})

describe('isRegistrationSelectable', () => {
  it('cancelled registrations are never selectable', () => {
    expect(isRegistrationSelectable('CANCELLED', true)).toBe(false)
    expect(isRegistrationSelectable('CANCELLED', false)).toBe(false)
  })

  it('waitlisted registrations are selectable only when explicitly included', () => {
    expect(isRegistrationSelectable('WAITLISTED', false)).toBe(false)
    expect(isRegistrationSelectable('WAITLISTED', true)).toBe(true)
  })

  it('confirmed registrations are always selectable', () => {
    expect(isRegistrationSelectable('CONFIRMED', false)).toBe(true)
    expect(isRegistrationSelectable('CONFIRMED', true)).toBe(true)
  })
})
