'use client'

import * as React from 'react'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'

import { cn } from '@/lib/utils'

interface SliderProps
  extends Omit<
    React.ComponentProps<typeof SliderPrimitive.Root<number>>,
    'value' | 'defaultValue' | 'onValueChange'
  > {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
}

function Slider({ className, value, defaultValue, onValueChange, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      className={cn('relative flex w-full touch-none items-center select-none', className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex w-full items-center py-1.5">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary motion-safe:transition-all motion-safe:duration-150" />
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            className={cn(
              'block size-4 rounded-full border-2 border-primary bg-background shadow-sm outline-none transition-colors motion-safe:transition-[left,right,top,bottom] motion-safe:duration-150',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
