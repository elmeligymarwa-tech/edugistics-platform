'use client'

import { useEffect } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getGlossaryEntry } from '@/lib/glossary/glossary-data'
import { useTermExplanation } from './use-term-explanation'

/**
 * The dialog body opened by a GlossaryHint icon: the written definition
 * (always shown, works with no network) plus the AI layer underneath —
 * fetched automatically on open, cached per project and term, and falling
 * back to a quiet note if the consultant call fails.
 */
export function TermExplanationPanel({
  termId,
  open,
  currentValue,
  context,
}: {
  termId: string
  open: boolean
  currentValue?: string
  context?: string
}) {
  const entry = getGlossaryEntry(termId)
  const { explanation, isLoading, error, fetchExplanation } = useTermExplanation(termId, currentValue, context)

  useEffect(() => {
    if (open) void fetchExplanation()
    // Only re-fires when the dialog opens, or on a manual retry via the
    // hook's own fetchExplanation identity — never on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!entry) return null

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry.title}</DialogTitle>
        {currentValue ? <DialogDescription>{currentValue}</DialogDescription> : null}
      </DialogHeader>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-foreground">{entry.definition}</p>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
            <Sparkles className="size-3.5" aria-hidden="true" />
            For this school
          </p>
          {isLoading ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Working it out for this school…
            </p>
          ) : explanation ? (
            <p className="text-sm whitespace-pre-wrap text-foreground">{explanation}</p>
          ) : error ? (
            <p className="text-xs text-muted-foreground">The detailed explanation is unavailable right now — the definition above still applies.</p>
          ) : null}
        </div>
      </div>
    </>
  )
}
