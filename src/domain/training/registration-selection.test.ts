import { describe, expect, it } from 'vitest'

import {
  EMPTY_SELECTION,
  areAllVisibleSelected,
  deselectVisible,
  isRegistrationSelectable,
  isRowSelected,
  selectAllMatchingFilters,
  selectVisible,
  toggleRow,
} from './registration-selection'

const FILTERS_A = 'status=CONFIRMED'
const FILTERS_B = 'status=WAITLISTED'

describe('toggleRow', () => {
  it('selects an individual row', () => {
    const state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, true)
    expect(state.mode).toBe('ids')
    expect(isRowSelected(state, 'reg-1', FILTERS_A)).toBe(true)
  })

  it('never selects a row the caller marks unselectable', () => {
    const state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, false)
    expect(state).toEqual(EMPTY_SELECTION)
    expect(isRowSelected(state, 'reg-1', FILTERS_A)).toBe(false)
  })

  it('toggling twice deselects the row', () => {
    let state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, true)
    state = toggleRow(state, 'reg-1', FILTERS_A, true)
    expect(state.mode).toBe('none')
  })

  // Defect 2: selecting rows and then switching filters used to silently
  // discard the whole selection.
  it('an ids-mode selection survives a filter change', () => {
    const state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, true)
    expect(isRowSelected(state, 'reg-1', FILTERS_B)).toBe(true)
  })

  it('a row can be added from a different filter than earlier selections, without losing them', () => {
    let state = toggleRow(EMPTY_SELECTION, 'reg-1', FILTERS_A, true)
    state = toggleRow(state, 'reg-2', FILTERS_B, true)
    expect(isRowSelected(state, 'reg-1', FILTERS_B)).toBe(true)
    expect(isRowSelected(state, 'reg-2', FILTERS_B)).toBe(true)
    expect(state.mode).toBe('ids')
    expect(state.ids.sort()).toEqual(['reg-1', 'reg-2'])
  })
})

describe('selectVisible', () => {
  it('selects every visible selectable row', () => {
    const state = selectVisible(EMPTY_SELECTION, ['reg-1', 'reg-2', 'reg-3'])
    expect(areAllVisibleSelected(state, ['reg-1', 'reg-2', 'reg-3'], FILTERS_A)).toBe(true)
  })

  it('selection persists across pagination within the same filter set', () => {
    // Page 1
    let state = selectVisible(EMPTY_SELECTION, ['reg-1', 'reg-2'])
    // Navigate to page 2 under the same filters — previous page's selection must survive.
    state = selectVisible(state, ['reg-3', 'reg-4'])
    expect(isRowSelected(state, 'reg-1', FILTERS_A)).toBe(true)
    expect(isRowSelected(state, 'reg-2', FILTERS_A)).toBe(true)
    expect(isRowSelected(state, 'reg-3', FILTERS_A)).toBe(true)
    expect(isRowSelected(state, 'reg-4', FILTERS_A)).toBe(true)
  })

  it('selection also persists across an actual filter change, not just pagination', () => {
    let state = selectVisible(EMPTY_SELECTION, ['reg-1', 'reg-2'])
    // Switch to a different filter (e.g. the waiting list) and select more rows there.
    state = selectVisible(state, ['reg-3'])
    expect(isRowSelected(state, 'reg-1', FILTERS_B)).toBe(true)
    expect(isRowSelected(state, 'reg-2', FILTERS_B)).toBe(true)
    expect(isRowSelected(state, 'reg-3', FILTERS_B)).toBe(true)
  })
})

describe('selectAllMatchingFilters', () => {
  it('selects every record for the given filters without enumerating ids', () => {
    const state = selectAllMatchingFilters(FILTERS_A)
    expect(state.mode).toBe('all')
    expect(isRowSelected(state, 'any-id-not-previously-seen', FILTERS_A)).toBe(true)
  })

  it('an id explicitly removed from an "all" selection is excluded', () => {
    let state = selectAllMatchingFilters(FILTERS_A)
    state = toggleRow(state, 'reg-5', FILTERS_A, true)
    expect(isRowSelected(state, 'reg-5', FILTERS_A)).toBe(false)
    expect(isRowSelected(state, 'reg-6', FILTERS_A)).toBe(true)
  })

  it('"all" persists across a filter change, but no longer reports rows from the new filter as selected', () => {
    const state = selectAllMatchingFilters(FILTERS_A)
    // Still "all" — not silently cleared just because the admin looked elsewhere.
    expect(state.mode).toBe('all')
    // But a row only visible under the new filter was never part of "all matching FILTERS_A".
    expect(isRowSelected(state, 'reg-7', FILTERS_B)).toBe(false)
  })

  it('toggling a row visible under a different filter than "all" covers is a no-op, not a redefinition of "all"', () => {
    const state = selectAllMatchingFilters(FILTERS_A)
    const afterToggle = toggleRow(state, 'reg-7', FILTERS_B, true)
    expect(afterToggle).toBe(state)
  })

  it('deselecting visible rows from a different filter than "all" covers is also a no-op', () => {
    const state = selectAllMatchingFilters(FILTERS_A)
    const afterDeselect = deselectVisible(state, ['reg-7', 'reg-8'], FILTERS_B)
    expect(afterDeselect).toBe(state)
  })

  it('areAllVisibleSelected reports false for rows outside the filter snapshot "all" covers', () => {
    const state = selectAllMatchingFilters(FILTERS_A)
    expect(areAllVisibleSelected(state, ['reg-7', 'reg-8'], FILTERS_B)).toBe(false)
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
