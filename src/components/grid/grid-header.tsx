'use client'

import type { Header, HeaderGroup } from '@tanstack/react-table'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  const isPinned = isLeaf && header.column.id === pinnedLeftColumnId

  // TanStack synthesizes a "placeholder" header for every column that doesn't reach the
  // table's deepest level (i.e. any column not inside a group, once some other column IS
  // grouped) so every row lines up. It reuses the same column id/label as the real header,
  // so left unfiltered it renders that column's label a second time, one row above its
  // actual header — an empty filler here is what leaves the group row genuinely empty
  // except where a group actually spans multiple columns.
  if (header.isPlaceholder) {
    return (
      <div
        key={header.id}
        className={cn(
          'h-9 shrink-0 border-r border-b border-border/60 bg-card',
          isPinned ? 'sticky left-0 z-30' : 'z-20',
        )}
        style={{ width: header.getSize(), minWidth: columnDefById.get(header.column.id)?.minWidth }}
      />
    )
  }

  const columnDef = isLeaf ? columnDefById.get(header.column.id) : undefined
  const groupMeta = !isLeaf ? groupMetaById.get(header.column.id) : undefined
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
      <span className="truncate" title={label}>{label}</span>
      {isLeaf && columnDef?.tooltip ? (
        <Tooltip>
          <TooltipTrigger
            aria-label={`What is ${label}?`}
            className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Info className="size-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>{columnDef.tooltip}</TooltipContent>
        </Tooltip>
      ) : null}
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
