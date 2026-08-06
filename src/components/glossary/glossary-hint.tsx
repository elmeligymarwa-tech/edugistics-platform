'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getGlossaryEntry } from '@/lib/glossary/glossary-data'
import { TermExplanationPanel } from './term-explanation-panel'

interface GlossaryHintProps {
  /** Glossary entry id, e.g. "ebitda" — see lib/glossary/glossary-data.ts. */
  term: string
  /** The figure currently on screen for this label, e.g. "EGP 7,920,000" — sent to the AI layer and shown in the panel. */
  currentValue?: string
  /** Where this appears, e.g. "Year 1 (2027/2028), profit and loss" — helps the AI layer ground its answer. */
  context?: string
  className?: string
}

/**
 * The two-layer glossary affordance attached beside a label: hovering (or
 * focusing, or tapping on touch) the info icon shows the plain written
 * definition in a tooltip — keyboard accessible and escape-dismissible via
 * the underlying Tooltip primitive. Clicking it opens a dialog with the same
 * definition plus the AI "for this school" explanation underneath.
 */
export function GlossaryHint({ term, currentValue, context, className }: GlossaryHintProps) {
  const entry = getGlossaryEntry(term)
  const [open, setOpen] = useState(false)
  if (!entry) return null

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          aria-label={`What is ${entry.title}?`}
          onClick={(event) => {
            event.stopPropagation()
            setOpen(true)
          }}
          className={cn(
            'inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
            className,
          )}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{entry.definition}</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <TermExplanationPanel termId={term} open={open} currentValue={currentValue} context={context} />
        </DialogContent>
      </Dialog>
    </>
  )
}
