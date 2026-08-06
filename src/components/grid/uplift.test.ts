import { describe, expect, it } from 'vitest'

import { upliftColumn } from './uplift'
import type { GridColumnDef } from './data-grid.types'

interface Row {
  id: string
  amount: number
  ratePct: number
  name: string
  locked?: boolean
}

const rows: Row[] = [
  { id: 'a', amount: 100, ratePct: 90, name: 'A' },
  { id: 'b', amount: 200, ratePct: 95, name: 'B', locked: true },
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

const rateColumn: GridColumnDef<Row> = {
  ...amountColumn,
  id: 'ratePct',
  kind: 'percent',
  getValue: (row) => row.ratePct,
}

const nameColumn: GridColumnDef<Row> = {
  ...amountColumn,
  id: 'name',
  kind: 'text',
  getValue: (row) => row.name,
}

describe('upliftColumn', () => {
  it('applies a percentage uplift to a numeric column, skipping disabled rows', () => {
    const patches = upliftColumn(rows, amountColumn, 10)
    expect(patches).toEqual([{ row: rows[0], columnId: 'amount', value: 110 }])
  })

  it('clamps a percent column uplift to 100', () => {
    const patches = upliftColumn([{ id: 'a', amount: 0, ratePct: 98, name: 'A' }], rateColumn, 10)
    expect(patches[0].value).toBe(100)
  })

  it('does nothing for a text column', () => {
    expect(upliftColumn(rows, nameColumn, 10)).toEqual([])
  })

  it('respects an explicit set of target rows', () => {
    const patches = upliftColumn(rows, amountColumn, 50, [0])
    expect(patches).toEqual([{ row: rows[0], columnId: 'amount', value: 150 }])
  })
})
