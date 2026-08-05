import * as React from 'react'

import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-[skeleton-shimmer_1.6s_ease-in-out_infinite] rounded-md bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_25%,color-mix(in_oklch,var(--muted),var(--foreground)_10%)_50%,var(--muted)_75%)]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
