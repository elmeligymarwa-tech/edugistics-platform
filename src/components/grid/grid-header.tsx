'use client'

import type { Header, HeaderGroup } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import { GridColumnMenu } from './grid-toolbar'
import type { GridColumnDef } from './data-grid.types'

interface GroupMeta {
  collapsible: boolean
}

interface GridHeaderProps<TRow> {
  headerGroups: HeaderGroup<TRow>[]
  columnDefById: Map<string, GridColumnDef<TRow>>
  groupMetaById: Map<string, GroupMeta>
  collapsedGroups: string[]
  mode: 'edit' | 'display'
  onToggleGroup: (groupId: string) => void
  onFillDownColumn: (columnId: string) => void
  onUpliftColumn: (columnId: string, percent: number) => void
  pinnedLeftColumnId?: string
}

function renderHeaderCell<TRow>(
  header: Header<TRow, unknown>,
  params: Omit<GridHeaderProps<TRow>, 'headerGroups'>,
) {
  const { columnDefById, groupMetaById, collapsedGroups, mode, onToggleGroup, onFillDownColumn, onUpliftColumn, pinnedLeftColumnId } =
    params
  const isLeaf = header.subHeaders.length === 0
  const columnDef = isLeaf ? columnDefById.get(header.column.id) : undefined
  const groupMeta = !isLeaf ? groupMetaById.get(header.column.id) : undefined
  const isPinned = isLeaf && header.column.id === pinnedLeftColumnId
  const isCollapsed = !isLeaf && collapsedGroups.includes(header.column.id)
  const label = typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.column.id

  return (
    <div
      key={header.id}
      className={cn(
        'group relative flex h-9 shrink-0 items-center gap-1 overflow-hidden border-r border-b border-border/60 bg-card px-2 text-xs font-medium text-heading',
        isPinned ? 'sticky left-0 z-30' : 'z-20',
        isLeaf ? (columnDef && (columnDef.kind === 'numeric' || columnDef.kind === 'percent') ? 'justify-end' : 'justify-start') : 'justify-start',
      )}
      style={{ width: header.getSize(), minWidth: columnDef?.minWidth }}
    >
      {groupMeta?.collapsible ? (
        <button
          type="button"
          onClick={() => onToggleGroup(header.column.id)}
          className="flex shrink-0 items-center text-muted-foreground hover:text-foreground"
          aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
        >
          {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      ) : null}
      <span className="truncate">{label}</span>
      {isLeaf && columnDef && mode === 'edit' ? (
        <GridColumnMenu
          columnLabel={columnDef.label}
          allowFillDown={Boolean(columnDef.allowFillDown)}
          allowUplift={Boolean(columnDef.allowUplift)}
          onFillDown={() => onFillDownColumn(columnDef.id)}
          onUplift={(percent) => onUpliftColumn(columnDef.id, percent)}
          className="ml-auto"
        />
      ) : null}
      {isLeaf && header.column.getCanResize() ? (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className="absolute top-0 right-0 h-9 w-1 shrink-0 cursor-col-resize touch-none select-none hover:bg-ring/50"
        />
      ) : null}
    </div>
  )
}

export function GridHeader<TRow>(props: GridHeaderProps<TRow>) {
  const { headerGroups, ...rest } = props
  return (
    <div className="sticky top-0 z-20 flex flex-col">
      {headerGroups.map((headerGroup) => (
        <div key={headerGroup.id} className="relative flex">
          {headerGroup.headers.map((header) => renderHeaderCell(header, rest))}
        </div>
      ))}
    </div>
  )
}
