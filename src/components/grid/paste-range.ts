import { coerceCellValue } from './coerce-value'
import type { CellPatch, GridColumnDef } from './data-grid.types'

/** Splits clipboard text (Excel/Sheets default TSV on copy) into a 2D grid of cell strings. */
export function parsePastedText(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  // A trailing blank line is the norm when copying a range from a spreadsheet — drop it rather than pasting an extra empty row.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t'))
}

/**
 * Maps pasted clipboard text onto the grid starting at the active cell,
 * clipping at the grid's bounds. Cells that land on a readonly or
 * per-row-disabled column are dropped, not errored — a spreadsheet paste
 * often includes extra columns the user doesn't intend to apply.
 */
export function buildPasteRangePatches<TRow>(params: {
  rows: TRow[]
  columns: GridColumnDef<TRow>[]
  clipboardText: string
  startRowIndex: number
  startColIndex: number
}): CellPatch<TRow>[] {
  const { rows, columns, clipboardText, startRowIndex, startColIndex } = params
  const grid = parsePastedText(clipboardText)
  const patches: CellPatch<TRow>[] = []

  grid.forEach((lineCells, rowOffset) => {
    const row = rows[startRowIndex + rowOffset]
    if (!row) return
    lineCells.forEach((cellText, colOffset) => {
      const column = columns[startColIndex + colOffset]
      if (!column) return
      if (column.kind === 'readonly') return
      if (column.disabled?.(row)) return
      patches.push({ row, columnId: column.id, value: coerceCellValue(column.kind, cellText) })
    })
  })

  return patches
}
