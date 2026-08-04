'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  items: SelectOption[]
  placeholder?: string
  triggerClassName?: string
  disabled?: boolean
  id?: string
  'aria-invalid'?: boolean
}

function Select({
  value,
  defaultValue,
  onValueChange,
  items,
  placeholder = 'Select…',
  triggerClassName,
  disabled,
  id,
  ...rest
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next as string)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select-trigger"
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
          triggerClassName,
        )}
        {...rest}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} className="z-50 outline-none">
          <SelectPrimitive.Popup
            data-slot="select-popup"
            className={cn(
              'max-h-64 min-w-[var(--anchor-width)] overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md',
              'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150',
              'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            )}
          >
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
                  'data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
                  'data-[selected]:font-medium',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
export type { SelectOption }
