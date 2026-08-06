'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import type { CapitalModel } from '@/domain/capital'
import type { CostModel } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import { validateModel } from '@/engine/analysis'

/**
 * Dismissible warning banner driven by validateModel: fee cap breaches and
 * any year the closing cash balance falls negative. Dismissal is per mount —
 * a genuinely new warning set (the assumptions changed again) re-opens it.
 */
export function ModelWarningBanner({
  project,
  costModel,
  capitalModel,
}: {
  project: Project
  costModel: CostModel
  capitalModel?: CapitalModel
}) {
  const warnings = useMemo(
    () => validateModel(project, costModel, capitalModel),
    [project, costModel, capitalModel],
  )
  const signature = warnings.map((warning) => `${warning.code}:${warning.yearIndex}`).join(',')
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null)

  if (warnings.length === 0 || dismissedSignature === signature) return null

  return (
    <Card className="border-warning/50 bg-warning/10">
      <CardContent className="flex-row items-start gap-3 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
        <ul className="flex-1 list-disc space-y-1 pl-4 text-sm text-warning-foreground">
          {warnings.map((warning) => (
            <li key={`${warning.code}-${warning.yearIndex}`}>{warning.message}</li>
          ))}
        </ul>
        <button
          type="button"
          aria-label="Dismiss warnings"
          onClick={() => setDismissedSignature(signature)}
          className="shrink-0 text-warning-foreground/70 hover:text-warning-foreground"
        >
          <X className="size-4" />
        </button>
      </CardContent>
    </Card>
  )
}
