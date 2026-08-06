import type { GridCellKind } from './data-grid.types'

/** Parses a pasted/typed string into the value shape a column of the given kind expects. Never rounds — clamping only enforces schema bounds (e.g. a percent column), not presentation. */
export function coerceCellValue(kind: GridCellKind, raw: string): string | number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return kind === 'text' || kind === 'select' ? '' : null

  if (kind === 'text' || kind === 'select') return trimmed

  const numeric = Number(trimmed.replace(/,/g, ''))
  if (Number.isNaN(numeric)) return null

  if (kind === 'percent') return Math.min(100, Math.max(0, numeric))
  if (kind === 'numeric') return numeric
  return numeric
}

/**
 * Most domain numeric fields (money, headcount, percentages) are non-nullable
 * `z.number()`. A cleared grid cell coerces to `null`; this turns that back
 * into 0 before it reaches a store action, so a schema-typed patch never
 * carries a null a non-nullable field can't accept. Fields that genuinely
 * are nullable (e.g. `maxStudents`) should use the raw grid value instead.
 */
export function toNumberOrZero(value: string | number | null): number {
  return typeof value === 'number' ? value : 0
}
