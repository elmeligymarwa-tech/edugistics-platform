import { describe, expect, it } from 'vitest'

import { fillDown } from './fill-down'
import type { GridColumnDef } from './data-grid.types'

interface Row {
  id: string
  amount: number
  locked?: boolean
}

const rows: Row[] = [
  { id: 'a', amount: 10 },
  { id: 'b', amount: 20 },
  { id: 'c', amount: 30 },
  { id: 'd', amount: 40, locked: true },
]

const amountColumn: GridColumnDef<Row> = {
  id: 'amount',
  label: 'Amount',
  kind: 'numeric',
  width: 100,
  minWidth: 96,
  getValue: (row) => row.amount,
  disabled: (row) => Boolean(row.locked),
}

describe('fillDown', () => {
  it('copies the source row value to every row below by default', () => {
    const patches = fillDown(rows, amountColumn, 0)
    expect(patches).toEqual([
      { row: rows[1], columnId: 'amount', value: 10 },
      { row: rows[2], columnId: 'amount', value: 10 },
    ])
  })

  it('skips rows whose cell is individually disabled', () => {
    const patches = fillDown(rows, amountColumn, 0, [1, 2, 3])
    expect(patches.map((patch) => patch.row.id)).toEqual(['b', 'c'])
  })

  it('respects an explicit set of target rows', () => {
    const patches = fillDown(rows, amountColumn, 1, [2])
    expect(patches).toEqual([{ row: rows[2], columnId: 'amount', value: 20 }])
  })

  it('returns nothing for a readonly column', () => {
    const readonlyColumn: GridColumnDef<Row> = { ...amountColumn, kind: 'readonly' }
    expect(fillDown(rows, readonlyColumn, 0)).toEqual([])
  })

  it('returns nothing when the source row does not exist', () => {
    expect(fillDown(rows, amountColumn, 99)).toEqual([])
  })
})
