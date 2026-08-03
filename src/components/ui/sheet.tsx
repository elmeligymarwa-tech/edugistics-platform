'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

function SheetContent({
  className,
  children,
  side = 'left',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & { side?: 'left' | 'right' }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-200',
          'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
        )}
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 z-50 flex w-72 flex-col gap-4 bg-card p-4 shadow-lg transition-transform duration-200 ease-out',
          side === 'left'
            ? 'left-0 border-r border-border data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full'
            : 'right-0 border-l border-border data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2 pr-6', className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle }
