import * as React from 'react'

import { Card } from '@/components/ui/card'
import { GlossaryHint } from '@/components/glossary/glossary-hint'
import { cn } from '@/lib/utils'

interface StatTileProps extends React.ComponentProps<'div'> {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  /** Glossary entry id — when present, an info icon beside the label opens the definition and AI explanation. */
  term?: string
  /** The value as plain text, for the glossary AI layer — falls back to `hint` then omits the figure if value isn't already a string. */
  glossaryValue?: string
}

function StatTile({ label, value, hint, term, glossaryValue, className, ...props }: StatTileProps) {
  const currentValue = glossaryValue ?? (typeof value === 'string' ? value : undefined)

  return (
    <Card className={cn('@container gap-1 overflow-hidden p-4', className)} {...props}>
      <p className="flex items-center gap-1 truncate text-xs font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {term ? (
          <GlossaryHint term={term} currentValue={currentValue} context={label} className="shrink-0" />
        ) : null}
      </p>
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
