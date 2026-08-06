'use client'

import * as React from 'react'

import type { CellCoordinate } from './data-grid.types'

interface UseGridKeyboardParams {
  mode: 'edit' | 'display'
  rowCount: number
  colCount: number
  activeCell: CellCoordinate | null
  editingCell: CellCoordinate | null
  setActiveCell: (cell: CellCoordinate, extend?: boolean) => void
  setEditingCell: (cell: CellCoordinate | null) => void
  onCopy: () => void
  isCellEditable: (cell: CellCoordinate) => boolean
}

/**
 * One delegated keydown handler on the grid root — critical for a 200-row
 * virtualized grid, where per-cell listeners would mean hundreds of live
 * handlers. Tab/arrows navigate, Shift+arrow extends the range, Enter opens
 * the active cell for editing (the cell itself owns commit-and-move-down),
 * Escape is handled by the editing cell. Cmd/Ctrl+C copies the current
 * range. Cmd/Ctrl+V is handled separately via the container's onPaste.
 */
export function useGridKeyboard({
  mode,
  rowCount,
  colCount,
  activeCell,
  editingCell,
  setActiveCell,
  setEditingCell,
  onCopy,
  isCellEditable,
}: UseGridKeyboardParams) {
  return React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingCell) return // the editing cell's own input owns Enter/Tab/Escape while active
      if (!activeCell) return

      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        onCopy()
        return
      }

      switch (event.key) {
        case 'Tab': {
          event.preventDefault()
          let { rowIndex, colIndex } = activeCell
          if (event.shiftKey) {
            colIndex -= 1
            if (colIndex < 0) {
              colIndex = colCount - 1
              rowIndex -= 1
            }
          } else {
            colIndex += 1
            if (colIndex >= colCount) {
              colIndex = 0
              rowIndex += 1
            }
          }
          if (rowIndex >= 0 && rowIndex < rowCount) setActiveCell({ rowIndex, colIndex })
          break
        }
        case 'ArrowRight':
          event.preventDefault()
          setActiveCell({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex + 1 }, event.shiftKey)
          break
        case 'ArrowLeft':
          event.preventDefault()
          setActiveCell({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex - 1 }, event.shiftKey)
          break
        case 'ArrowDown':
          event.preventDefault()
          setActiveCell({ rowIndex: activeCell.rowIndex + 1, colIndex: activeCell.colIndex }, event.shiftKey)
          break
        case 'ArrowUp':
          event.preventDefault()
          setActiveCell({ rowIndex: activeCell.rowIndex - 1, colIndex: activeCell.colIndex }, event.shiftKey)
          break
        case 'Enter':
          if (mode === 'edit' && isCellEditable(activeCell)) {
            event.preventDefault()
            setEditingCell(activeCell)
          }
          break
        default:
          break
      }
    },
    [activeCell, colCount, editingCell, isCellEditable, mode, onCopy, rowCount, setActiveCell, setEditingCell],
  )
}
