import type { CellPatch, GridColumnDef } from './data-grid.types'

/**
 * Copies one row's value in a column down to every row below it (or to an
 * explicit set of target row indices, e.g. the current selection). Rows
 * whose cell is individually disabled (a derived/locked figure) are skipped.
 */
export function fillDown<TRow>(
  rows: TRow[],
  column: GridColumnDef<TRow>,
  sourceRowIndex: number,
  targetRowIndices?: number[],
): CellPatch<TRow>[] {
  const source = rows[sourceRowIndex]
  if (!source || column.kind === 'readonly') return []

  const value = column.getValue(source)
  const targets = targetRowIndices ?? rows.map((_, index) => index).filter((index) => index > sourceRowIndex)

  return targets
    .map((index) => rows[index])
    .filter((row): row is TRow => row !== undefined)
    .filter((row) => !column.disabled?.(row))
    .map((row) => ({ row, columnId: column.id, value }))
}
