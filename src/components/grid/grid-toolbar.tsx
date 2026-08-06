'use client'

import * as React from 'react'
import { ChevronDown, MoreVertical } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface GridColumnMenuProps {
  columnLabel: string
  allowFillDown: boolean
  allowUplift: boolean
  onFillDown: () => void
  onUplift: (percent: number) => void
  className?: string
}

/** Per-column header menu offering fill-down and percentage-uplift actions, shown on hover/focus so the dense grid stays visually calm. */
export function GridColumnMenu({
  columnLabel,
  allowFillDown,
  allowUplift,
  onFillDown,
  onUplift,
  className,
}: GridColumnMenuProps) {
  const [upliftValue, setUpliftValue] = React.useState('5')

  if (!allowFillDown && !allowUplift) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100',
          className,
        )}
        aria-label={`${columnLabel} column actions`}
      >
        <MoreVertical className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{columnLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allowFillDown ? (
          <DropdownMenuItem onClick={onFillDown}>
            <ChevronDown className="size-3.5" />
            Fill down
          </DropdownMenuItem>
        ) : null}
        {allowUplift ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <Input
              type="number"
              value={upliftValue}
              onChange={(event) => setUpliftValue(event.target.value)}
              className="h-7 w-16"
              aria-label="Uplift percentage"
            />
            <span className="text-xs text-muted-foreground">%</span>
            <button
              type="button"
              className="ml-auto rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
              onClick={() => {
                const parsed = Number(upliftValue)
                if (!Number.isNaN(parsed)) onUplift(parsed)
              }}
            >
              Uplift
            </button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
