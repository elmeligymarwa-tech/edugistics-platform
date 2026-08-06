import { type GridColumnDef, type GridColumnGroup, type GridRowGroup, isGridColumnGroup, isGridRowGroup } from './data-grid.types'

/** Flattens grouped column headers into the leaf columns actually rendered as cells, in order. */
export function flattenColumns<TRow>(
  columns: (GridColumnDef<TRow> | GridColumnGroup<TRow>)[],
): GridColumnDef<TRow>[] {
  return columns.flatMap((column) => (isGridColumnGroup(column) ? column.columns : [column]))
}

/** Flattens row groups into a plain row list, alongside a parallel array recording each row's group label (or null for ungrouped rows). */
export function flattenRows<TRow>(
  rows: TRow[] | GridRowGroup<TRow>[],
): { row: TRow; groupId: string | null; groupLabel: string | null }[] {
  if (rows.length === 0) return []
  if (!isGridRowGroup(rows[0] as TRow | GridRowGroup<TRow>)) {
    return (rows as TRow[]).map((row) => ({ row, groupId: null, groupLabel: null }))
  }
  return (rows as GridRowGroup<TRow>[]).flatMap((group) =>
    group.rows.map((row) => ({ row, groupId: group.id, groupLabel: group.label })),
  )
}
