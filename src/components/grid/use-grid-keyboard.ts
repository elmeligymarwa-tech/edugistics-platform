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
  setEditingCell: (cell: CellCoordinate | null, seed?: string | null) => void
  onCopy: () => void
  isCellEditable: (cell: CellCoordinate) => boolean
  /**
   * Lets the host special-case a typed character per cell — a select-kind column jumps
   * straight to the first option starting with that letter (native <select> typeahead)
   * instead of opening a free-text edit seeded with it. Return true to say "handled,
   * don't open editing"; false/undefined falls through to the default seeded-edit-open.
   */
  onTypeahead?: (cell: CellCoordinate, key: string) => boolean
  /**
   * Builds the seed string for the default (non-typeahead) case: a numeric/percent cell
   * replaces its whole value, so the seed is just the typed key; a text cell keeps its
   * existing value and appends the key, so typing never wipes out what was already there.
   */
  buildEditSeed: (cell: CellCoordinate, key: string) => string
}

/**
 * One delegated keydown handler on the grid root — critical for a 200-row
 * virtualized grid, where per-cell listeners would mean hundreds of live
 * handlers. Tab/arrows navigate, Shift+arrow extends the range, Enter opens
 * the active cell for editing (the cell itself owns commit-and-move-down),
 * Escape is handled by the editing cell. Cmd/Ctrl+C copies the current
 * range. Cmd/Ctrl+V is handled separately via the container's onPaste.
 * Typing a plain character on an active (non-editing) cell also opens it for
 * editing, seeded with that character, so it replaces the value as it would
 * in a spreadsheet.
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
  onTypeahead,
  buildEditSeed,
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
          if (
            mode === 'edit' &&
            event.key.length === 1 &&
            !meta &&
            !event.altKey &&
            isCellEditable(activeCell)
          ) {
            event.preventDefault()
            const handled = onTypeahead?.(activeCell, event.key)
            if (!handled) setEditingCell(activeCell, buildEditSeed(activeCell, event.key))
          }
          break
      }
    },
    [
      activeCell,
      buildEditSeed,
      colCount,
      editingCell,
      isCellEditable,
      mode,
      onCopy,
      onTypeahead,
      rowCount,
      setActiveCell,
      setEditingCell,
    ],
  )
}
