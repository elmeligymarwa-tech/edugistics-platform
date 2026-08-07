import type { FormattedCurrency } from '@/lib/format'

export type GridCellKind = 'text' | 'numeric' | 'percent' | 'select' | 'readonly'

export interface GridSelectOption {
  value: string
  label: string
}

export interface GridColumnDef<TRow> {
  id: string
  label: string
  kind: GridCellKind
  /** Default width in pixels, overridden by a persisted width if one exists for this gridId. */
  width: number
  /** Enforces the "figures never clip" floor — the column never renders narrower than this. */
  minWidth: number
  /** Row-label columns are pinned left so they stay visible on horizontal scroll. */
  pinned?: 'left'
  selectOptions?: GridSelectOption[]
  getValue: (row: TRow) => string | number | null
  onCommit?: (row: TRow, value: string | number | null) => void
  /** Per-row escape hatch for cells that are individually locked, e.g. a derived headcount. */
  disabled?: (row: TRow) => boolean
  /**
   * Presentation-only formatting. Never used for rounding inside the engine.
   * Currency columns return the `{text, negative}` shape from
   * formatMoney/formatCompactMoney so the cell colours from the formatter's
   * own flag rather than re-testing the raw value.
   */
  format?: (value: string | number | null) => string | FormattedCurrency
  /**
   * Escape hatch for rich, non-text cell content (e.g. a value with a
   * colour-coded delta on a second line). When present it replaces the
   * format/value text entirely in display; edit mode still edits the plain
   * value via `format`/`getValue` as normal.
   */
  render?: (row: TRow) => React.ReactNode
  allowFillDown?: boolean
  allowUplift?: boolean
  /**
   * Hidden until the grid's "Show more columns" toggle is switched on. Lets a wide grid
   * default to only its essential columns while keeping the rest a click away.
   */
  secondary?: boolean
}

export interface GridColumnGroup<TRow> {
  id: string
  label: string
  columns: GridColumnDef<TRow>[]
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function isGridColumnGroup<TRow>(
  column: GridColumnDef<TRow> | GridColumnGroup<TRow>,
): column is GridColumnGroup<TRow> {
  return 'columns' in column
}

export interface GridRowGroup<TRow> {
  id: string
  label: string
  rows: TRow[]
}

export function isGridRowGroup<TRow>(row: TRow | GridRowGroup<TRow>): row is GridRowGroup<TRow> {
  return typeof row === 'object' && row !== null && 'rows' in row && Array.isArray((row as GridRowGroup<TRow>).rows)
}

export interface CellPatch<TRow> {
  row: TRow
  columnId: string
  value: string | number | null
}

export type CellCoordinate = { rowIndex: number; colIndex: number }

export type CellRange = { anchor: CellCoordinate; focus: CellCoordinate }

export interface DataGridProps<TRow> {
  /** Flat rows, or rows grouped by section (e.g. staff section). */
  rows: TRow[] | GridRowGroup<TRow>[]
  getRowId: (row: TRow) => string
  columns: (GridColumnDef<TRow> | GridColumnGroup<TRow>)[]
  /**
   * 'edit' supports keyboard editing, paste, fill-down and uplift.
   * 'display' is read-only (forecast/statement tables) but keeps pinning,
   * virtualization, the frozen header and numeric styling — cell navigation
   * and copy still work.
   */
  mode: 'edit' | 'display'
  /** Key for persisted column widths/collapsed groups in the grid-ui store. */
  gridId: string
  /** Applies a batch of pasted or filled-down cells; the host coalesces these into one store call. */
  onPasteRange?: (patches: CellPatch<TRow>[]) => void
  emptyState?: React.ReactNode
  ariaLabel: string
  className?: string
  /** Row height in pixels. Fixed — this is a dense grid, not a variable-height list. */
  rowHeight?: number
  /** Extra classes for a data row's wrapper, e.g. `font-semibold` on a subtotal/total line. Font weight cascades into each cell since GridCell never sets its own. */
  getRowClassName?: (row: TRow) => string | undefined
}
