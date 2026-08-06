import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { FormattedCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface DrilldownRow {
  label: string
  /** Pass the `{text, negative}` object from formatMoney/formatCompactMoney for currency rows so colour comes from the formatter, not a plain string. */
  value: string | FormattedCurrency
  emphasis?: boolean
}

export interface DrilldownContent {
  title: string
  description?: string
  rows: DrilldownRow[]
}

export function CellDrilldownDialog({
  content,
  onOpenChange,
}: {
  content: DrilldownContent | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={content !== null} onOpenChange={onOpenChange}>
      {content ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{content.title}</DialogTitle>
            {content.description ? <DialogDescription>{content.description}</DialogDescription> : null}
          </DialogHeader>
          <dl className="flex flex-col divide-y divide-border">
            {content.rows.map((row, index) => {
              const { value } = row
              const isFormattedCurrency = typeof value === 'object'
              const text = isFormattedCurrency ? value.text : value
              const negative = isFormattedCurrency && value.negative
              return (
                <div key={index} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <dt className={row.emphasis ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                    {row.label}
                  </dt>
                  <dd
                    className={cn(
                      'tabular-nums',
                      row.emphasis ? 'font-semibold' : '',
                      negative ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {text}
                  </dd>
                </div>
              )
            })}
          </dl>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
