'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Slider } from './slider'

interface SliderNumberFieldProps {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step: number
  /** Larger jump for Page Up/Page Down. Defaults to 10x step, capped to the range. */
  largeStep?: number
  /** Shown after the number input, e.g. "%" or "x". */
  suffix?: string
  id?: string
  disabled?: boolean
  'aria-label'?: string
  className?: string
  numberClassName?: string
}

/**
 * Pairs a slider with a compact, always-editable number box: dragging the
 * slider updates the number, typing in the number updates the slider, and
 * the exact value is always visible. The number box only clamps to
 * [min, max] on blur/Enter so a value can be typed digit by digit without
 * the field snapping mid-entry.
 */
function SliderNumberField({
  value,
  onValueChange,
  min,
  max,
  step,
  largeStep,
  suffix,
  id,
  disabled,
  className,
  numberClassName,
  'aria-label': ariaLabel,
}: SliderNumberFieldProps) {
  const [text, setText] = React.useState(() => String(value))

  React.useEffect(() => {
    setText(String(value))
  }, [value])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    setText(raw)
    const parsed = Number(raw)
    // Live-updates the slider (and the underlying value) as soon as the text
    // parses to a number, clamped so an out-of-range value never reaches the
    // store — but the box itself keeps showing exactly what was typed until
    // blur, so digit-by-digit entry never gets rewritten mid-keystroke.
    if (raw.trim() !== '' && !Number.isNaN(parsed)) {
      onValueChange(Math.min(max, Math.max(min, parsed)))
    }
  }

  const commit = (raw: string) => {
    const parsed = Number(raw)
    const next = raw.trim() === '' || Number.isNaN(parsed) ? value : Math.min(max, Math.max(min, parsed))
    onValueChange(next)
    setText(String(next))
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Slider
        className="flex-1"
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        largeStep={largeStep ?? Math.min(max - min, step * 10)}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <div className="flex shrink-0 items-center gap-1">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          aria-label={ariaLabel}
          disabled={disabled}
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(event.currentTarget.value)
          }}
          className={cn(
            'h-8 w-16 rounded-lg border border-input bg-background px-2 text-right text-sm text-foreground tabular-nums outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            numberClassName,
          )}
        />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  )
}

export { SliderNumberField }
