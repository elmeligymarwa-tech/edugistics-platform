// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { DataGrid } from './data-grid'
import type { GridColumnDef } from './data-grid.types'

interface Row {
  id: string
  name: string
  amount: number
  status: string
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    name: `Year group ${index}`,
    amount: index * 10,
    status: 'active',
  }))
}

const nameColumn: GridColumnDef<Row> = {
  id: 'name',
  label: 'Name',
  kind: 'text',
  width: 160,
  minWidth: 120,
  pinned: 'left',
  getValue: (row) => row.name,
}

const amountColumn: GridColumnDef<Row> = {
  id: 'amount',
  label: 'Amount',
  kind: 'numeric',
  width: 100,
  minWidth: 96,
  getValue: (row) => row.amount,
}

function editableAmountColumn(onCommit: (row: Row, value: string | number | null) => void): GridColumnDef<Row> {
  return { ...amountColumn, onCommit }
}

const statusColumn: GridColumnDef<Row> = {
  id: 'status',
  label: 'Status',
  kind: 'select',
  width: 120,
  minWidth: 96,
  selectOptions: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  getValue: (row) => row.status,
}

function editableStatusColumn(onCommit: (row: Row, value: string | number | null) => void): GridColumnDef<Row> {
  return { ...statusColumn, onCommit }
}

function getGridCell(grid: HTMLElement, text: string): HTMLElement {
  const cell = within(grid).getByText(text).closest('[role="gridcell"]')
  if (!cell) throw new Error(`No gridcell ancestor found for text "${text}"`)
  return cell as HTMLElement
}

beforeEach(() => {
  // react-virtual reads offsetHeight/offsetWidth to size its viewport; jsdom
  // reports 0 for both, which would make it render nothing at all.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 400 })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DataGrid', () => {
  it('renders column headers and row values', () => {
    render(
      <DataGrid
        rows={makeRows(3)}
        getRowId={(row) => row.id}
        columns={[nameColumn, amountColumn]}
        mode="display"
        gridId="test-basic"
        ariaLabel="Test grid"
      />,
    )

    const grid = screen.getByRole('grid', { name: 'Test grid' })
    expect(within(grid).getByText('Name')).toBeInTheDocument()
    expect(within(grid).getByText('Amount')).toBeInTheDocument()
    expect(within(grid).getByText('Year group 0')).toBeInTheDocument()
    expect(within(grid).getByText('20')).toBeInTheDocument()
  })

  it('reports the full row count via aria-rowcount even when virtualized', () => {
    render(
      <DataGrid
        rows={makeRows(200)}
        getRowId={(row) => row.id}
        columns={[nameColumn, amountColumn]}
        mode="display"
        gridId="test-virtualized"
        ariaLabel="Large grid"
      />,
    )

    const grid = screen.getByRole('grid', { name: 'Large grid' })
    expect(grid).toHaveAttribute('aria-rowcount', '200')
    // Virtualization means far fewer than 200 row-0 cells actually mount.
    expect(screen.queryAllByText(/^Year group \d+$/).length).toBeLessThan(200)
  })

  it('renders a pinned row-label column', () => {
    render(
      <DataGrid
        rows={makeRows(2)}
        getRowId={(row) => row.id}
        columns={[nameColumn, amountColumn]}
        mode="edit"
        gridId="test-pinned"
        ariaLabel="Pinned grid"
      />,
    )
    const grid = screen.getByRole('grid', { name: 'Pinned grid' })
    expect(within(grid).getByText('Year group 0')).toBeInTheDocument()
  })

  it('shows the empty state when there are no rows', () => {
    render(
      <DataGrid
        rows={[]}
        getRowId={(row: Row) => row.id}
        columns={[nameColumn, amountColumn]}
        mode="edit"
        gridId="test-empty"
        ariaLabel="Empty grid"
        emptyState="Nothing here yet"
      />,
    )
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })

  it('opens a cell for editing on a single click, with the existing value selected', () => {
    const onCommit = vi.fn()
    render(
      <DataGrid
        rows={makeRows(3)}
        getRowId={(row) => row.id}
        columns={[nameColumn, editableAmountColumn(onCommit)]}
        mode="edit"
        gridId="test-click-edit"
        ariaLabel="Click edit grid"
      />,
    )
    const grid = screen.getByRole('grid', { name: 'Click edit grid' })

    fireEvent.mouseDown(getGridCell(grid, '20'))

    const input = within(grid).getByDisplayValue('20') as HTMLInputElement
    expect(input).toHaveFocus()
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 2])
  })

  it('opens the option list on a single click for a select cell', () => {
    // jsdom has no HTMLSelectElement.showPicker implementation — stub it so we can assert
    // the cell actually calls it (a plain focus() alone doesn't open a native list).
    const showPicker = vi.fn()
    Object.defineProperty(HTMLSelectElement.prototype, 'showPicker', {
      configurable: true,
      writable: true,
      value: showPicker,
    })

    const onCommit = vi.fn()
    const rows = makeRows(3).map((row, index) => ({ ...row, status: index === 0 ? 'active' : 'inactive' }))
    render(
      <DataGrid
        rows={rows}
        getRowId={(row) => row.id}
        columns={[nameColumn, editableStatusColumn(onCommit)]}
        mode="edit"
        gridId="test-select-click-open"
        ariaLabel="Select click grid"
      />,
    )
    const grid = screen.getByRole('grid', { name: 'Select click grid' })

    fireEvent.mouseDown(getGridCell(grid, 'Active'))

    const select = within(grid).getByRole('combobox')
    expect(select).toHaveFocus()
    expect(showPicker).toHaveBeenCalledTimes(1)

    delete (HTMLSelectElement.prototype as { showPicker?: () => void }).showPicker
  })

  it('starts editing, seeded with the typed character, when typing on an active cell without clicking', () => {
    const onCommit = vi.fn()
    render(
      <DataGrid
        rows={makeRows(3)}
        getRowId={(row) => row.id}
        columns={[nameColumn, editableAmountColumn(onCommit)]}
        mode="edit"
        gridId="test-type-edit"
        ariaLabel="Type edit grid"
      />,
    )
    const grid = screen.getByRole('grid', { name: 'Type edit grid' })

    // Shift+click only activates the cell (range-selection semantics) — it must not
    // open it for editing, so this exercises typing on an active-but-not-editing cell.
    fireEvent.mouseDown(getGridCell(grid, '20'), { shiftKey: true })
    expect(screen.queryByDisplayValue('20')).not.toBeInTheDocument()

    fireEvent.keyDown(grid, { key: '5' })

    const input = within(grid).getByDisplayValue('5') as HTMLInputElement
    expect(input).toHaveFocus()
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1])
  })

  it('commits the draft on blur, not only on enter or tab', () => {
    const onCommit = vi.fn()
    const rows = makeRows(3)
    render(
      <DataGrid
        rows={rows}
        getRowId={(row) => row.id}
        columns={[nameColumn, editableAmountColumn(onCommit)]}
        mode="edit"
        gridId="test-blur-commit"
        ariaLabel="Blur commit grid"
      />,
    )
    const grid = screen.getByRole('grid', { name: 'Blur commit grid' })

    fireEvent.mouseDown(getGridCell(grid, '20'))
    const input = within(grid).getByDisplayValue('20') as HTMLInputElement
    fireEvent.change(input, { target: { value: '42' } })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledWith(rows[2], 42)
  })

  it('commits the draft when blurred by clicking a different cell, not just a direct blur event', () => {
    const onCommit = vi.fn()
    const rows = makeRows(3)
    render(
      <DataGrid
        rows={rows}
        getRowId={(row) => row.id}
        columns={[nameColumn, editableAmountColumn(onCommit)]}
        mode="edit"
        gridId="test-blur-commit-via-click"
        ariaLabel="Blur commit via click grid"
      />,
    )
    const grid = screen.getByRole('grid', { name: 'Blur commit via click grid' })

    fireEvent.mouseDown(getGridCell(grid, '20'))
    const input = within(grid).getByDisplayValue('20') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1' } })

    // Click a different cell without pressing Enter/Tab or blurring directly — this is what
    // exposed the bug: the click's own mousedown must not discard the pending edit.
    fireEvent.mouseDown(getGridCell(grid, '0'))

    expect(onCommit).toHaveBeenCalledWith(rows[2], 1)
    expect(screen.queryByDisplayValue('20')).not.toBeInTheDocument()
  })
})
