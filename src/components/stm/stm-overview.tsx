'use client'

import { Handshake } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StmAgreementEditor } from '@/components/stm/stm-agreement-editor'
import { StmCategoryToggleList } from '@/components/stm/stm-category-toggle-list'
import { StmImpactPanel } from '@/components/stm/stm-impact-panel'
import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'
import type { Forecast } from '@/engine/revenue'
import { useProjectStore } from '@/store/project-store'

export function StmOverview({
  project,
  forecast,
  costForecast,
}: {
  project: Project
  forecast: Forecast
  costForecast: CostForecast
}) {
  const stm = project.stm
  const updateStm = useProjectStore((state) => state.updateStm)

  const addAgreement = () =>
    updateStm(project.id, {
      counterpartyName: 'New counterparty',
      basis: 'netRevenue',
      ratePct: 0,
      tiers: [],
      minimumGuarantee: null,
      paymentFrequency: 'annual',
      startYearIndex: 0,
      endYearIndex: null,
    })

  if (!stm) {
    return (
      <Card>
        <CardContent className="items-start gap-3 pt-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Handshake className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">No STM agreement configured</p>
            <p className="max-w-prose text-sm text-muted-foreground">
              Set up the terms of a third-party revenue-share or management fee agreement — the
              counterparty, basis and rate — and see the computed liability for each forecast year.
            </p>
          </div>
          <Button size="sm" onClick={addAgreement}>
            Add STM agreement
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StmAgreementEditor project={project} stm={stm} forecast={forecast} />
      <StmCategoryToggleList project={project} />
      <StmImpactPanel project={project} costForecast={costForecast} />
    </div>
  )
}
