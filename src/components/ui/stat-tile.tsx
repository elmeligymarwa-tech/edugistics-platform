import * as React from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatTileProps extends React.ComponentProps<'div'> {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
}

function StatTile({ label, value, hint, className, ...props }: StatTileProps) {
  return (
    <Card className={cn('@container gap-1 overflow-hidden p-4', className)} {...props}>
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      {/* Scales down in a narrow tile and up once there's room, via a native
       * container query rather than a resize observer, so a KPI figure
       * never overflows its card at any window width. */}
      <p className="truncate text-lg font-semibold tabular-nums text-foreground @[11rem]:text-xl @[16rem]:text-2xl">
        {value}
      </p>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}

export { StatTile }
