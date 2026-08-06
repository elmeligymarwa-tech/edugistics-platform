'use client'

import * as React from 'react'

import type { CellCoordinate, CellRange } from './data-grid.types'

/**
 * Tracks the active cell and the current range selection for one grid
 * instance. Purely ephemeral UI state — never persisted, never touches the
 * Zustand store — so a grid can be re-mounted without carrying stale focus.
 */
export function useGridSelection(rowCount: number, colCount: number) {
  const [activeCell, setActiveCellState] = React.useState<CellCoordinate | null>(null)
  const [range, setRange] = React.useState<CellRange | null>(null)
  const [editingCell, setEditingCell] = React.useState<CellCoordinate | null>(null)

  const clamp = React.useCallback(
    (cell: CellCoordinate): CellCoordinate => ({
      rowIndex: Math.min(Math.max(cell.rowIndex, 0), Math.max(rowCount - 1, 0)),
      colIndex: Math.min(Math.max(cell.colIndex, 0), Math.max(colCount - 1, 0)),
    }),
    [rowCount, colCount],
  )

  const setActiveCell = React.useCallback(
    (cell: CellCoordinate, extend = false) => {
      const clamped = clamp(cell)
      setActiveCellState(clamped)
      setEditingCell(null)
      setRange((prev) => (extend && prev ? { anchor: prev.anchor, focus: clamped } : { anchor: clamped, focus: clamped }))
    },
    [clamp],
  )

  const isCellActive = React.useCallback(
    (cell: CellCoordinate) => activeCell?.rowIndex === cell.rowIndex && activeCell?.colIndex === cell.colIndex,
    [activeCell],
  )

  const isCellSelected = React.useCallback(
    (cell: CellCoordinate): boolean => {
      if (!range) return false
      const rowMin = Math.min(range.anchor.rowIndex, range.focus.rowIndex)
      const rowMax = Math.max(range.anchor.rowIndex, range.focus.rowIndex)
      const colMin = Math.min(range.anchor.colIndex, range.focus.colIndex)
      const colMax = Math.max(range.anchor.colIndex, range.focus.colIndex)
      return (
        cell.rowIndex >= rowMin && cell.rowIndex <= rowMax && cell.colIndex >= colMin && cell.colIndex <= colMax
      )
    },
    [range],
  )

  const rangeBounds = React.useMemo(() => {
    if (!range) return null
    return {
      rowMin: Math.min(range.anchor.rowIndex, range.focus.rowIndex),
      rowMax: Math.max(range.anchor.rowIndex, range.focus.rowIndex),
      colMin: Math.min(range.anchor.colIndex, range.focus.colIndex),
      colMax: Math.max(range.anchor.colIndex, range.focus.colIndex),
    }
  }, [range])

  return {
    activeCell,
    editingCell,
    setEditingCell,
    setActiveCell,
    isCellActive,
    isCellSelected,
    rangeBounds,
    clamp,
  }
}
