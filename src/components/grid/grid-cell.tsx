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
  /** The character that started this edit by typing, replacing the value as a spreadsheet would. Null when editing started from the existing value (click, double click, Enter). */
  editSeed: string | null
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
  editSeed,
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
  const inputRef = React.useRef<HTMLInputElement>(null)
  const selectRef = React.useRef<HTMLSelectElement>(null)
  const wasEditingRef = React.useRef(false)

  // Runs synchronously before paint so the input never flashes a stale value and the
  // programmatic focus/selection below always acts on the text the user is meant to see.
  // A select-kind cell ignores the seed (it isn't a free-text draft) and just opens.
  React.useLayoutEffect(() => {
    if (!isEditing) {
      wasEditingRef.current = false
      return
    }
    const justStarted = !wasEditingRef.current
    wasEditingRef.current = true

    if (column.kind === 'select') {
      setDraft(value === null ? '' : String(value))
      const select = selectRef.current
      if (select && justStarted) {
        select.focus()
        // The <select> doesn't exist in the DOM until this render (isEditing only flips
        // true after the click/keydown that started the edit), so the browser never sees
        // a real user gesture land directly on it — autoFocus alone leaves the list
        // closed. showPicker() opens it programmatically; it only succeeds within the
        // brief "transient activation" window left over from that originating click or
        // keydown, which this layout effect still runs inside of. Guarded because
        // showPicker isn't implemented everywhere (e.g. jsdom, older browsers) and can
        // throw if activation has already lapsed — the select is still focused and
        // openable by hand (click again, or Enter/Space/Arrow) either way.
        try {
          select.showPicker?.()
        } catch {
          // Activation expired or unsupported — select remains focused and usable.
        }
      }
      return
    }

    const useSeed = justStarted && editSeed !== null
    const nextDraft = useSeed ? editSeed : value === null ? '' : String(value)

    const input = inputRef.current
    if (input) input.value = nextDraft
    setDraft(nextDraft)

    if (input) {
      input.focus()
      if (useSeed) {
        const caret = editSeed.length
        input.setSelectionRange(caret, caret)
      } else if (isNumeric) {
        // Numeric/percent cells stay spreadsheet-style: the whole value is selected so the
        // next keystroke replaces it. Text cells deliberately fall through with no explicit
        // selection — assigning `input.value` above already left the caret collapsed at the
        // end, and a plain click's own (unprevented) mouseup then moves it to the click point;
        // see the input's onMouseUp below.
        input.select()
      }
    }
  }, [isEditing, value, editSeed, column.kind, isNumeric])

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
      onMouseDown={(event) => {
        // onActivate below moves editingCell to this cell, which unmounts whatever cell's
        // input is currently focused elsewhere in the same synchronous render. A native
        // blur fired mid-unmount doesn't reliably reach that input's onBlur prop, silently
        // dropping its draft. Blurring the outgoing input here — while it's still mounted —
        // lets its own onBlur commit first. Skipped when the focus is already inside this
        // cell (e.g. clicking within the input you're already editing).
        const active = document.activeElement
        if (active instanceof HTMLElement && !event.currentTarget.contains(active)) active.blur()
        onActivate(event.shiftKey)
        // A plain click both selects and opens the cell for editing, spreadsheet-style;
        // a shift+click only extends the range selection. onBeginEdit no-ops when disabled.
        if (!event.shiftKey) onBeginEdit()
      }}
      onDoubleClick={() => {
        // A text cell's single click deliberately leaves the caret wherever it was clicked
        // (see the layout effect and the input's onMouseUp below) rather than selecting
        // everything. Double click is the explicit "select the whole value" gesture instead —
        // this overrides whatever the browser's own double-click-selects-a-word default just
        // did to the input's selection. Numeric/percent cells already select-all on the first
        // click, so they have nothing extra to do here.
        if (!disabled && column.kind === 'text') inputRef.current?.select()
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
          ref={selectRef}
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
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // The layout effect above already selected the whole value for a numeric/percent
          // cell; the browser's own mouseup-after-focus would otherwise collapse that
          // selection down to a caret at the click point. Text cells want exactly that
          // click-point caret, so their mouseup is left to run.
          onMouseUp={(event) => {
            if (isNumeric) event.preventDefault()
          }}
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
