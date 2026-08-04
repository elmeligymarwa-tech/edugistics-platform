import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface DrilldownRow {
  label: string
  value: string
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
            {content.rows.map((row, index) => (
              <div key={index} className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className={row.emphasis ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {row.label}
                </dt>
                <dd
                  className={
                    row.emphasis
                      ? 'font-semibold text-foreground tabular-nums'
                      : 'text-foreground tabular-nums'
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
