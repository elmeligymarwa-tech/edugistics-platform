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
    <Card className={cn('gap-1 p-4', className)} {...props}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}

export { StatTile }
