'use client'

import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface TruncateWithTooltipProps extends React.ComponentProps<'span'> {
  text: string
}

/**
 * Truncates long labels with an ellipsis instead of letting them wrap or
 * clip, and only shows a tooltip with the full text when the label actually
 * overflows its box — never on labels that already fit.
 */
function TruncateWithTooltip({ text, className, ...props }: TruncateWithTooltipProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = React.useState(false)

  const checkOverflow = React.useCallback(() => {
    const element = ref.current
    if (element) setIsOverflowing(element.scrollWidth > element.clientWidth)
  }, [])

  React.useEffect(() => {
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [checkOverflow, text])

  const label = (
    <span
      ref={ref}
      onMouseEnter={checkOverflow}
      className={cn('block truncate', className)}
      {...props}
    >
      {text}
    </span>
  )

  if (!isOverflowing) return label

  return (
    <Tooltip>
      <TooltipTrigger render={label} />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

export { TruncateWithTooltip }
