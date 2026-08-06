'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import type { CostForecast } from '@/engine/costs'
import type { Project } from '@/domain/schema'
import { formatMoneySigned, formatPercent } from '@/lib/format'
import { useCostModel } from '@/store/project-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useConsultantConversation } from './use-consultant-conversation'

/**
 * Digests the already-computed CostForecast into plain text for the model
 * to critique — every figure comes from the existing engine output, never
 * recomputed here.
 */
function buildForecastDigest(project: Project, forecast: CostForecast): string {
  const lines = forecast.years.map((year) => {
    return `Year ${year.yearIndex + 1} (${year.label}): ${year.students} students, net revenue ${formatMoneySigned(year.netRevenue, project.meta)}, payroll ${formatMoneySigned(year.payroll, project.meta)}, opex ${formatMoneySigned(year.opex, project.meta)}, EBITDA margin ${formatPercent(year.ebitdaMarginPct)}, net profit ${formatMoneySigned(year.netProfit, project.meta)}, cost per student ${formatMoneySigned(year.costPerStudent, project.meta)}.`
  })

  const breakEven =
    forecast.breakEvenYearIndex === null
      ? 'Break-even is not reached within the forecast.'
      : `Break-even occurs in year ${forecast.breakEvenYearIndex + 1}.`

  return [
    `Review the following ${forecast.years.length}-year forecast for ${project.meta.schoolName || 'this school'}.`,
    ...lines,
    breakEven,
    `Cash low point: ${formatMoneySigned(forecast.cashLowPoint, project.meta)}.`,
    `Peak funding requirement: ${formatMoneySigned(forecast.peakFundingRequirement, project.meta)}.`,
  ].join('\n')
}

interface ReviewActionProps {
  project: Project
  forecast: CostForecast
}

/**
 * Button + dialog that sends the already-computed forecast to the
 * consultant for a critique — read-only prose, no proposal or JSON in this
 * mode. Mounted on Statements and Dashboard.
 */
export function ReviewAction({ project, forecast }: ReviewActionProps) {
  const costModel = useCostModel(project.id)
  const { messages, latestResponse, isLoading, error, send, reset } = useConsultantConversation(
    'review',
    project,
    costModel,
  )
  const [draft, setDraft] = useState('')
  const [hasRequested, setHasRequested] = useState(false)

  const requestReview = () => {
    setHasRequested(true)
    void send(buildForecastDigest(project, forecast))
  }

  const handleFollowUp = () => {
    const trimmed = draft.trim()
    if (!trimmed || isLoading) return
    setDraft('')
    void send(trimmed)
  }

  const isRtl = latestResponse?.language === 'ar'

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          reset()
          setHasRequested(false)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="print:hidden" onClick={requestReview}>
            <Sparkles /> Ask the consultant to review
          </Button>
        }
      />

      <DialogContent className="max-w-lg" dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>Consultant review</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {!hasRequested && <p className="text-sm text-muted-foreground">Preparing the review…</p>}
          {messages
            .filter((message) => message.role === 'assistant')
            .map((message, index) => (
              <p key={index} className="text-sm whitespace-pre-wrap text-foreground">
                {message.content}
              </p>
            ))}
          {isLoading && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reviewing the forecast…
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {hasRequested && !isLoading && (
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleFollowUp()
                }
              }}
              placeholder="Ask a follow-up question…"
            />
            <Button size="sm" onClick={handleFollowUp} disabled={!draft.trim()}>
              Ask
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
