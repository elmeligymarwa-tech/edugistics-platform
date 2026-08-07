'use client'

import * as React from 'react'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useGridUiStore } from '@/store/grid-ui-store'

import type { CellCoordinate, DataGridProps, GridColumnDef, GridColumnGroup } from './data-grid.types'
import { isGridColumnGroup } from './data-grid.types'
import { fillDown } from './fill-down'
import { flattenColumns, flattenRows } from './flatten-columns'
import { GridCell, type GridCellMove } from './grid-cell'
import { GridHeader } from './grid-header'
import { buildPasteRangePatches } from './paste-range'
import { upliftColumn } from './uplift'
import { useGridKeyboard } from './use-grid-keyboard'
import { useGridSelection } from './use-grid-selection'

const DEFAULT_ROW_HEIGHT = 36
// A stable empty-array reference for Zustand selectors — useSyncExternalStore
// requires getSnapshot to return referentially identical output when the
// underlying state hasn't changed, so `?? []` (a fresh literal every call)
// causes an infinite render loop.
const EMPTY_STRING_ARRAY: string[] = []

interface FlatRowEntry<TRow> {
  type: 'group-header' | 'data'
  rowId: string
  groupId: string | null
  groupLabel?: string
  row?: TRow
}

export function DataGrid<TRow>(props: DataGridProps<TRow>) {
  const {
    rows,
    getRowId,
    columns,
    mode,
    gridId,
    onPasteRange,
    emptyState,
    ariaLabel,
    className,
    rowHeight = DEFAULT_ROW_HEIGHT,
    getRowClassName,
  } = props

  // A group that holds only one column has nothing to group — rendering it as a
  // GridColumnGroup would give TanStack Table two header rows (the group's label, then
  // the same single leaf's label) for what reads as one column. Unwrapping it here, before
  // anything else derives from `columns`, means the group header row only ever appears
  // where a group genuinely spans several columns.
  const normalizedColumns = React.useMemo(
    () => columns.map((column) => (isGridColumnGroup(column) && column.columns.length === 1 ? column.columns[0]! : column)),
    [columns],
  )

  const leafColumns = React.useMemo(() => flattenColumns(normalizedColumns), [normalizedColumns])
  const pinnedLeftColumnId = leafColumns.find((column) => column.pinned === 'left')?.id

  const columnDefById = React.useMemo(() => {
    const map = new Map<string, GridColumnDef<TRow>>()
    for (const column of leafColumns) map.set(column.id, column)
    return map
  }, [leafColumns])

  const groupMetaById = React.useMemo(() => {
    const map = new Map<string, { collapsible: boolean }>()
    for (const column of normalizedColumns) {
      if (isGridColumnGroup(column)) map.set(column.id, { collapsible: Boolean(column.collapsible) })
    }
    return map
  }, [normalizedColumns])

  const leafIdsByGroup = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const column of normalizedColumns) {
      if (isGridColumnGroup(column)) map.set(column.id, column.columns.map((leaf) => leaf.id))
    }
    return map
  }, [normalizedColumns])

  const hasSecondaryColumns = React.useMemo(() => leafColumns.some((column) => column.secondary), [leafColumns])
  const showSecondaryColumns = useGridUiStore((state) => state.showSecondaryColumns[gridId] ?? false)
  const setShowSecondaryColumns = useGridUiStore((state) => state.setShowSecondaryColumns)

  const flatRows = React.useMemo(() => flattenRows(rows), [rows])

  const entries = React.useMemo<FlatRowEntry<TRow>[]>(() => {
    const out: FlatRowEntry<TRow>[] = []
    let currentGroup: string | null | undefined
    for (const { row, groupId, groupLabel } of flatRows) {
      if (groupId !== null && groupId !== currentGroup) {
        out.push({ type: 'group-header', rowId: `__group__${groupId}`, groupId, groupLabel: groupLabel ?? undefined })
      }
      currentGroup = groupId
      out.push({ type: 'data', rowId: getRowId(row), groupId, row })
    }
    return out
  }, [flatRows, getRowId])

  const collapsedGroups = useGridUiStore((state) => state.collapsedGroups[gridId] ?? EMPTY_STRING_ARRAY)
  const toggleGroupCollapsed = useGridUiStore((state) => state.toggleGroupCollapsed)
  const setColumnWidths = useGridUiStore((state) => state.setColumnWidths)

  const visibleEntries = React.useMemo(
    () => entries.filter((entry) => entry.type === 'group-header' || entry.groupId === null || !collapsedGroups.includes(entry.groupId)),
    [entries, collapsedGroups],
  )

  const dataEntries = React.useMemo(() => visibleEntries.filter((entry) => entry.type === 'data'), [visibleEntries])
  const dataRowIndexById = React.useMemo(() => {
    const map = new Map<string, number>()
    dataEntries.forEach((entry, index) => map.set(entry.rowId, index))
    return map
  }, [dataEntries])

  const columnVisibility = React.useMemo(() => {
    const visibility: VisibilityState = {}
    for (const groupId of collapsedGroups) {
      // Keep the first leaf column visible so the group's own header cell
      // (and its expand toggle) still renders — hiding every leaf column
      // makes TanStack Table drop the group header entirely, leaving no way
      // back to expanded.
      const leafIds = leafIdsByGroup.get(groupId) ?? []
      for (const id of leafIds.slice(1)) visibility[id] = false
    }
    if (!showSecondaryColumns) {
      for (const column of leafColumns) {
        if (column.secondary) visibility[column.id] = false
      }
    }
    return visibility
  }, [collapsedGroups, leafIdsByGroup, leafColumns, showSecondaryColumns])

  const tableColumns = React.useMemo<ColumnDef<TRow, unknown>[]>(() => {
    const toColumnDef = (column: GridColumnDef<TRow> | GridColumnGroup<TRow>): ColumnDef<TRow, unknown> =>
      isGridColumnGroup(column)
        ? { id: column.id, header: column.label, columns: column.columns.map(toColumnDef) }
        : {
            id: column.id,
            header: column.label,
            accessorFn: (row: TRow) => column.getValue(row),
            size: column.width,
            minSize: column.minWidth,
          }
    return normalizedColumns.map(toColumnDef)
  }, [normalizedColumns])

  const emptyData = React.useMemo<TRow[]>(() => [], [])

  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => {
    const persisted = useGridUiStore.getState().columnWidths[gridId] ?? {}
    const sizing: ColumnSizingState = {}
    for (const column of leafColumns) sizing[column.id] = persisted[column.id] ?? column.width
    return sizing
  })

  const widthPersistTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleColumnSizingChange = React.useCallback(
    (updater: Updater<ColumnSizingState>) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (widthPersistTimer.current) clearTimeout(widthPersistTimer.current)
        widthPersistTimer.current = setTimeout(() => setColumnWidths(gridId, next), 300)
        return next
      })
    },
    [gridId, setColumnWidths],
  )

  const table = useReactTable({
    data: emptyData,
    columns: tableColumns,
    state: { columnSizing, columnVisibility },
    onColumnSizingChange: handleColumnSizingChange,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
  })

  const tableLeafColumns = table.getVisibleLeafColumns()
  const visibleColumns = React.useMemo(
    () =>
      tableLeafColumns
        .map((tableColumn) => {
          const def = columnDefById.get(tableColumn.id)
          return def ? { def, size: tableColumn.getSize() } : null
        })
        .filter((entry): entry is { def: GridColumnDef<TRow>; size: number } => entry !== null),
    [tableLeafColumns, columnDefById],
  )
  const totalWidth = visibleColumns.reduce((sum, entry) => sum + entry.size, 0)

  const {
    activeCell,
    editingCell,
    editSeed,
    setEditingCell,
    setActiveCell,
    isCellActive,
    isCellSelected,
    rangeBounds,
  } = useGridSelection(dataEntries.length, visibleColumns.length)

  const isCellEditable = React.useCallback(
    (cell: CellCoordinate) => {
      const entry = dataEntries[cell.rowIndex]
      const column = visibleColumns[cell.colIndex]?.def
      return Boolean(entry?.row && column && column.kind !== 'readonly' && !column.disabled?.(entry.row))
    },
    [dataEntries, visibleColumns],
  )

  const handleCopy = React.useCallback(() => {
    if (!rangeBounds) return
    const lines: string[] = []
    for (let rowIndex = rangeBounds.rowMin; rowIndex <= rangeBounds.rowMax; rowIndex += 1) {
      const entry = dataEntries[rowIndex]
      if (!entry?.row) continue
      const cells: string[] = []
      for (let colIndex = rangeBounds.colMin; colIndex <= rangeBounds.colMax; colIndex += 1) {
        const column = visibleColumns[colIndex]?.def
        if (!column) continue
        const value = column.getValue(entry.row)
        const formatted = column.format?.(value)
        cells.push(typeof formatted === 'object' ? formatted.text : (formatted ?? (value ?? '').toString()))
      }
      lines.push(cells.join('\t'))
    }
    const text = lines.join('\n')
    if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(text)
  }, [dataEntries, rangeBounds, visibleColumns])

  const handleTypeahead = React.useCallback(
    (cell: CellCoordinate, key: string) => {
      const entry = dataEntries[cell.rowIndex]
      const column = visibleColumns[cell.colIndex]?.def
      if (!entry?.row || !column || column.kind !== 'select') return false
      // Space opens the list, matching Enter, rather than jumping to an option labelled
      // with a leading space.
      if (key === ' ') {
        setEditingCell(cell)
        return true
      }
      const lower = key.toLowerCase()
      const match = column.selectOptions?.find((option) => option.label.toLowerCase().startsWith(lower))
      if (match && match.value !== column.getValue(entry.row)) column.onCommit?.(entry.row, match.value)
      return true
    },
    [dataEntries, setEditingCell, visibleColumns],
  )

  const handleKeyDown = useGridKeyboard({
    mode,
    rowCount: dataEntries.length,
    colCount: visibleColumns.length,
    activeCell,
    editingCell,
    setActiveCell,
    setEditingCell,
    onCopy: handleCopy,
    isCellEditable,
    onTypeahead: handleTypeahead,
  })

  const handleCellCommit = React.useCallback(
    (rowIndex: number, colIndex: number, value: string | number | null, move: GridCellMove) => {
      const entry = dataEntries[rowIndex]
      const column = visibleColumns[colIndex]?.def
      // A click now opens a cell for editing, so a blur-commit fires on every click, not
      // just an actual change — skip the store write when nothing actually changed.
      if (entry?.row && column?.onCommit && !column.disabled?.(entry.row) && value !== column.getValue(entry.row)) {
        column.onCommit(entry.row, value)
      }
      setEditingCell(null)

      // A blur-triggered commit ('none') never repositions the active cell: it's already
      // correct, whether unchanged (blur with no navigation) or moved to wherever the user
      // clicked next (that cell's own mousedown activates it before this blur cascade runs,
      // since committing here happens as a side effect of this cell's input unmounting).
      if (move === 'none') return
      let nextRow = rowIndex
      let nextCol = colIndex
      if (move === 'down') {
        nextRow += 1
      } else if (move === 'tab') {
        nextCol += 1
        if (nextCol >= visibleColumns.length) {
          nextCol = 0
          nextRow += 1
        }
      } else if (move === 'tab-back') {
        nextCol -= 1
        if (nextCol < 0) {
          nextCol = visibleColumns.length - 1
          nextRow -= 1
        }
      }
      setActiveCell({ rowIndex: nextRow, colIndex: nextCol })
    },
    [dataEntries, setActiveCell, setEditingCell, visibleColumns],
  )

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (mode !== 'edit' || !activeCell || !onPasteRange) return
      const text = event.clipboardData.getData('text/plain')
      if (!text) return
      event.preventDefault()
      const patches = buildPasteRangePatches({
        rows: dataEntries.map((entry) => entry.row as TRow),
        columns: visibleColumns.map((entry) => entry.def),
        clipboardText: text,
        startRowIndex: activeCell.rowIndex,
        startColIndex: activeCell.colIndex,
      })
      if (patches.length > 0) onPasteRange(patches)
    },
    [activeCell, dataEntries, mode, onPasteRange, visibleColumns],
  )

  const handleFillDownColumn = React.useCallback(
    (columnId: string) => {
      const column = columnDefById.get(columnId)
      if (!column || !onPasteRange) return
      const colIndex = visibleColumns.findIndex((entry) => entry.def.id === columnId)
      const sourceIndex = activeCell && activeCell.colIndex === colIndex ? activeCell.rowIndex : 0
      const patches = fillDown(
        dataEntries.map((entry) => entry.row as TRow),
        column,
        sourceIndex,
      )
      if (patches.length > 0) onPasteRange(patches)
    },
    [activeCell, columnDefById, dataEntries, onPasteRange, visibleColumns],
  )

  const handleUpliftColumn = React.useCallback(
    (columnId: string, percent: number) => {
      const column = columnDefById.get(columnId)
      if (!column || !onPasteRange) return
      const patches = upliftColumn(
        dataEntries.map((entry) => entry.row as TRow),
        column,
        percent,
      )
      if (patches.length > 0) onPasteRange(patches)
    },
    [columnDefById, dataEntries, onPasteRange],
  )

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  const showMoreColumnsToggle = hasSecondaryColumns ? (
    <div className="flex items-center justify-end border-b border-border/60 bg-card px-2 py-1">
      <button
        type="button"
        onClick={() => setShowSecondaryColumns(gridId, !showSecondaryColumns)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {showSecondaryColumns ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {showSecondaryColumns ? 'Show fewer columns' : 'Show more columns'}
      </button>
    </div>
  ) : null

  if (dataEntries.length === 0 && emptyState) {
    return (
      <div className={cn('flex flex-col overflow-hidden rounded-lg border border-border', className)}>
        {showMoreColumnsToggle}
        <GridHeader
          headerGroups={table.getHeaderGroups()}
          columnDefById={columnDefById}
          groupMetaById={groupMetaById}
          collapsedGroups={collapsedGroups}
          mode={mode}
          onToggleGroup={(groupId) => toggleGroupCollapsed(gridId, groupId)}
          onFillDownColumn={handleFillDownColumn}
          onUpliftColumn={handleUpliftColumn}
          pinnedLeftColumnId={pinnedLeftColumnId}
        />
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">{emptyState}</div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border border-border', className)}>
      {showMoreColumnsToggle}
      <div
        ref={scrollRef}
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={dataEntries.length}
        aria-colcount={visibleColumns.length}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="relative max-h-[32rem] overflow-auto outline-none"
      >
        <div style={{ width: Math.max(totalWidth, 1) }}>
          <GridHeader
            headerGroups={table.getHeaderGroups()}
            columnDefById={columnDefById}
            groupMetaById={groupMetaById}
            collapsedGroups={collapsedGroups}
            mode={mode}
            onToggleGroup={(groupId) => toggleGroupCollapsed(gridId, groupId)}
            onFillDownColumn={handleFillDownColumn}
            onUpliftColumn={handleUpliftColumn}
            pinnedLeftColumnId={pinnedLeftColumnId}
          />
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = visibleEntries[virtualRow.index]
              if (!entry) return null

              if (entry.type === 'group-header') {
                return (
                  <div
                    key={entry.rowId}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center border-b border-border/60 bg-muted/60 px-2 text-xs font-semibold text-heading"
                  >
                    {entry.groupLabel}
                  </div>
                )
              }

              const dataRowIndex = dataRowIndexById.get(entry.rowId) ?? 0
              const row = entry.row as TRow
              // Zebra striping must stay fully opaque (not alpha-transparent), otherwise
              // horizontally-scrolled content would bleed through the sticky pinned column.
              const rowClassName = cn(dataRowIndex % 2 === 1 && 'bg-muted', getRowClassName?.(row))

              return (
                <div
                  key={entry.rowId}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: totalWidth,
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex"
                >
                  {visibleColumns.map(({ def: column, size }, colIndex) => {
                    const cellCoord: CellCoordinate = { rowIndex: dataRowIndex, colIndex }
                    const isEditing = editingCell?.rowIndex === dataRowIndex && editingCell?.colIndex === colIndex
                    return (
                      <GridCell
                        key={column.id}
                        row={row}
                        column={column}
                        mode={mode}
                        width={size}
                        height={virtualRow.size}
                        pinnedOffset={column.pinned === 'left' ? 0 : undefined}
                        rowClassName={rowClassName}
                        isActive={isCellActive(cellCoord)}
                        isSelected={isCellSelected(cellCoord)}
                        isEditing={isEditing}
                        editSeed={isEditing ? editSeed : null}
                        onActivate={(extend) => setActiveCell(cellCoord, extend)}
                        onBeginEdit={() => {
                          if (mode === 'edit' && column.kind !== 'readonly' && !column.disabled?.(row)) {
                            setActiveCell(cellCoord)
                            setEditingCell(cellCoord)
                          }
                        }}
                        onCommit={(value, move) => handleCellCommit(dataRowIndex, colIndex, value, move)}
                        onCancelEdit={() => setEditingCell(null)}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
