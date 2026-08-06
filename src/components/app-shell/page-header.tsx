import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-heading">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
