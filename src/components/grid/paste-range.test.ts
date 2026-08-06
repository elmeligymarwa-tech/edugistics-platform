import { describe, expect, it } from 'vitest'

import { buildPasteRangePatches, parsePastedText } from './paste-range'
import type { GridColumnDef } from './data-grid.types'

interface Row {
  id: string
  name: string
  amount: number
  ratePct: number
  locked?: boolean
}

const rows: Row[] = [
  { id: 'a', name: 'A', amount: 0, ratePct: 0 },
  { id: 'b', name: 'B', amount: 0, ratePct: 0 },
  { id: 'c', name: 'C', amount: 0, ratePct: 0, locked: true },
]

const columns: GridColumnDef<Row>[] = [
  { id: 'name', label: 'Name', kind: 'text', width: 100, minWidth: 96, getValue: (r) => r.name },
  { id: 'amount', label: 'Amount', kind: 'numeric', width: 100, minWidth: 96, getValue: (r) => r.amount },
  {
    id: 'ratePct',
    label: 'Rate',
    kind: 'percent',
    width: 100,
    minWidth: 96,
    getValue: (r) => r.ratePct,
    disabled: (r) => Boolean(r.locked),
  },
  { id: 'computed', label: 'Computed', kind: 'readonly', width: 100, minWidth: 96, getValue: () => 0 },
]

describe('parsePastedText', () => {
  it('splits on newlines and tabs', () => {
    expect(parsePastedText('1\t2\n3\t4')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('drops a single trailing blank line', () => {
    expect(parsePastedText('1\t2\n')).toEqual([['1', '2']])
  })

  it('normalises CRLF line endings', () => {
    expect(parsePastedText('1\t2\r\n3\t4')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })
})

describe('buildPasteRangePatches', () => {
  it('maps a pasted 2D block onto rows/columns starting at the active cell', () => {
    const patches = buildPasteRangePatches({
      rows,
      columns,
      clipboardText: 'Alpha\t150\nBeta\t250',
      startRowIndex: 0,
      startColIndex: 0,
    })
    expect(patches).toEqual([
      { row: rows[0], columnId: 'name', value: 'Alpha' },
      { row: rows[0], columnId: 'amount', value: 150 },
      { row: rows[1], columnId: 'name', value: 'Beta' },
      { row: rows[1], columnId: 'amount', value: 250 },
    ])
  })

  it('clips at grid bounds instead of throwing', () => {
    const patches = buildPasteRangePatches({
      rows,
      columns,
      clipboardText: '1\t2\n3\t4\n5\t6\n7\t8',
      startRowIndex: 1,
      startColIndex: 1,
    })
    // Rows beyond index 2 (only 3 rows exist) are silently dropped; row 'c' has
    // ratePct disabled, so only its 'amount' cell survives.
    expect(patches.map((p) => `${p.row.id}:${p.columnId}`)).toEqual(['b:amount', 'b:ratePct', 'c:amount'])
  })

  it('drops cells landing on a readonly column', () => {
    const patches = buildPasteRangePatches({
      rows,
      columns,
      clipboardText: '1\t2\t3\t4',
      startRowIndex: 0,
      startColIndex: 0,
    })
    expect(patches.some((p) => p.columnId === 'computed')).toBe(false)
  })

  it('drops cells landing on a row-disabled column', () => {
    const patches = buildPasteRangePatches({
      rows,
      columns,
      clipboardText: '10\t20\t30',
      startRowIndex: 2,
      startColIndex: 1,
    })
    expect(patches.some((p) => p.columnId === 'ratePct')).toBe(false)
  })

  it('clamps a percent paste to 0-100', () => {
    const patches = buildPasteRangePatches({
      rows,
      columns,
      clipboardText: '150',
      startRowIndex: 0,
      startColIndex: 2,
    })
    expect(patches).toEqual([{ row: rows[0], columnId: 'ratePct', value: 100 }])
  })

  it('coerces an empty numeric cell to null', () => {
    const patches = buildPasteRangePatches({
      rows,
      columns,
      clipboardText: '',
      startRowIndex: 0,
      startColIndex: 1,
    })
    expect(patches).toEqual([{ row: rows[0], columnId: 'amount', value: null }])
  })
})
