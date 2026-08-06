import type { CellPatch, GridColumnDef } from './data-grid.types'

/**
 * Applies a percentage uplift to every row's value in a numeric or percent
 * column (or an explicit set of target row indices, e.g. the current
 * selection). Percent columns clamp to 0-100; the clamp happens here, at the
 * point of proposing the patch, not inside any engine.
 */
export function upliftColumn<TRow>(
  rows: TRow[],
  column: GridColumnDef<TRow>,
  upliftPct: number,
  targetRowIndices?: number[],
): CellPatch<TRow>[] {
  if (column.kind !== 'numeric' && column.kind !== 'percent') return []

  const targets = targetRowIndices ?? rows.map((_, index) => index)

  return targets
    .map((index) => rows[index])
    .filter((row): row is TRow => row !== undefined)
    .filter((row) => !column.disabled?.(row))
    .map((row): CellPatch<TRow> | null => {
      const current = column.getValue(row)
      if (typeof current !== 'number') return null
      // Rounded to the nearest hundredth to avoid floating-point noise (e.g. 100 * 1.1 -> 110.00000000000001)
      // landing in a domain field. This is input sanitisation, not engine rounding.
      const next = Math.round(current * (1 + upliftPct / 100) * 100) / 100
      const value = column.kind === 'percent' ? Math.min(100, Math.max(0, next)) : next
      return { row, columnId: column.id, value }
    })
    .filter((patch): patch is CellPatch<TRow> => patch !== null)
}
