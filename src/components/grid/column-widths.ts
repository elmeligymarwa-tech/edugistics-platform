/**
 * Reusable width presets so a grid's columns are sized to what their content actually
 * needs — a short whole number stays narrow, a name or currency figure gets more room —
 * rather than every column defaulting to the same generic width regardless of kind.
 */
export const COLUMN_WIDTH = {
  /** A small whole number: classrooms, teachers, headcount, a year index. */
  count: { width: 96, minWidth: 80 },
  /** A percentage figure, plus its slider-popover icon. */
  percent: { width: 104, minWidth: 92 },
  /** A currency figure, which can run into the thousands. */
  money: { width: 136, minWidth: 112 },
  /** An enum/select cell. */
  select: { width: 132, minWidth: 112 },
  /** A computed, read-only reference figure. */
  readonly: { width: 104, minWidth: 92 },
  /** A pinned row-label column (a name or title). */
  label: { width: 200, minWidth: 160 },
  /** A short pinned row-label column (e.g. a year group code). */
  shortLabel: { width: 136, minWidth: 116 },
} as const
