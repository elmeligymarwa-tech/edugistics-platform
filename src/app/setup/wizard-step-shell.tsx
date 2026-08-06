import type { ReactNode } from 'react'

interface WizardStepShellProps {
  title: string
  description?: string
  totals: ReactNode
  footer: ReactNode
  children: ReactNode
}

/**
 * Consistent layout for every wizard step: a fixed header (step name + live
 * totals), a scrollable body, and a fixed footer (back/next, validation
 * errors). The parent must be a flex column with a bounded height — see
 * `wizard.tsx` and `setup/page.tsx` — so this shell's own body scroll is the
 * one that activates, not the page's.
 */
export function WizardStepShell({ title, description, totals, footer, children }: WizardStepShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-heading">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">{totals}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      <div className="shrink-0 border-t border-border px-4 py-3 sm:px-6">{footer}</div>
    </div>
  )
}
