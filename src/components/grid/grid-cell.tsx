'use client'

import * as React from 'react'
import { SlidersHorizontal } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SliderNumberField } from '@/components/ui/slider-number-field'
import { cn } from '@/lib/utils'

import { coerceCellValue } from './coerce-value'
import type { GridColumnDef } from './data-grid.types'

const PERCENT_MIN = 0
const PERCENT_MAX = 100
const PERCENT_STEP = 0.5

export type GridCellMove = 'down' | 'tab' | 'tab-back' | 'none'

interface GridCellProps<TRow> {
  row: TRow
  column: GridColumnDef<TRow>
  mode: 'edit' | 'display'
  isActive: boolean
  isSelected: boolean
  isEditing: boolean
  width: number
  height: number
  pinnedOffset?: number
  /** e.g. a zebra tint or `font-semibold` for a subtotal/total row. Must stay opaque so a sticky pinned cell still occludes scrolled content. */
  rowClassName?: string
  onActivate: (extend: boolean) => void
  onBeginEdit: () => void
  onCommit: (value: string | number | null, move: GridCellMove) => void
  onCancelEdit: () => void
}

export function GridCell<TRow>({
  row,
  column,
  mode,
  isActive,
  isSelected,
  isEditing,
  width,
  height,
  pinnedOffset,
  rowClassName,
  onActivate,
  onBeginEdit,
  onCommit,
  onCancelEdit,
}: GridCellProps<TRow>) {
  const value = column.getValue(row)
  const disabled = mode === 'display' || column.kind === 'readonly' || Boolean(column.disabled?.(row))
  const isNumeric = column.kind === 'numeric' || column.kind === 'percent'
  const isPinned = column.pinned === 'left'

  const [draft, setDraft] = React.useState(() => (value === null ? '' : String(value)))

  React.useEffect(() => {
    if (isEditing) setDraft(value === null ? '' : String(value))
  }, [isEditing, value])

  const commitDraft = (move: GridCellMove) => onCommit(coerceCellValue(column.kind, draft), move)

  const optionLabel =
    column.kind === 'select' ? (column.selectOptions?.find((option) => option.value === value)?.label ?? null) : null
  const formatted = column.format?.(value)
  const isFormattedCurrency = typeof formatted === 'object' && formatted !== null
  const displayText = isFormattedCurrency
    ? formatted.text
    : (formatted ?? optionLabel ?? (value === null || value === '' ? '' : String(value)))
  const isNegative = isFormattedCurrency ? formatted.negative : typeof value === 'number' && value < 0

  return (
    <div
      role="gridcell"
      aria-selected={isActive}
      tabIndex={-1}
      onMouseDown={(event) => onActivate(event.shiftKey)}
      onDoubleClick={() => {
        if (!disabled) onBeginEdit()
      }}
      style={{
        width,
        height,
        minWidth: column.minWidth,
        ...(isPinned ? { position: 'sticky', left: pinnedOffset ?? 0 } : {}),
      }}
      className={cn(
        'flex shrink-0 items-center overflow-hidden border-r border-b border-border/60 bg-card px-2 text-sm',
        isPinned && 'z-10',
        rowClassName,
        isNumeric ? 'justify-end tabular-nums' : 'justify-start',
        isNegative ? 'text-destructive' : 'text-foreground',
        disabled && !isEditing && 'text-muted-foreground',
        isActive && 'outline outline-2 -outline-offset-2 outline-ring z-20',
        !isActive && isSelected && 'bg-accent/40',
      )}
    >
      {isEditing && column.kind === 'select' ? (
        <select
          autoFocus
          value={draft}
          onChange={(event) => onCommit(event.target.value, 'none')}
          onBlur={() => onCancelEdit()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onCancelEdit()
            }
          }}
          className="w-full bg-transparent outline-none"
        >
          {column.selectOptions?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : isEditing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={() => commitDraft('none')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft('down')
            } else if (event.key === 'Tab') {
              event.preventDefault()
              commitDraft(event.shiftKey ? 'tab-back' : 'tab')
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onCancelEdit()
            }
          }}
          className={cn('w-full bg-transparent tabular-nums outline-none', isNumeric ? 'text-right' : 'text-left')}
        />
      ) : column.render ? (
        column.render(row)
      ) : column.kind === 'percent' && !disabled ? (
        <Popover>
          <PopoverTrigger
            aria-label={`Adjust ${column.label} with a slider`}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            className="mr-1 flex shrink-0 items-center rounded p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-3" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-64">
            <SliderNumberField
              value={typeof value === 'number' ? value : 0}
              onValueChange={(next) => column.onCommit?.(row, next)}
              min={PERCENT_MIN}
              max={PERCENT_MAX}
              step={PERCENT_STEP}
              suffix="%"
              aria-label={column.label}
            />
          </PopoverContent>
          <span className="truncate" title={displayText.length > 12 ? displayText : undefined}>
            {displayText}
          </span>
        </Popover>
      ) : (
        <span className="truncate" title={displayText.length > 12 ? displayText : undefined}>
          {displayText}
        </span>
      )}
    </div>
  )
}
