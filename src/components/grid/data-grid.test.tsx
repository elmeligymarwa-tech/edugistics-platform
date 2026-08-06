// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { DataGrid } from './data-grid'
import type { GridColumnDef } from './data-grid.types'

interface Row {
  id: string
  name: string
  amount: number
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    name: `Year group ${index}`,
    amount: index * 10,
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
})
