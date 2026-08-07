'use client'

import { useEffect, useMemo, useState } from 'react'

import { CellDrilldownDialog, type DrilldownContent } from '@/components/revenue/cell-drilldown-dialog'
import type { Project } from '@/domain/schema'
import type { CapitalForecast } from '@/engine/capital'
import type { CostForecast } from '@/engine/costs'
import type { Forecast } from '@/engine/revenue'
import { capitalForecastToDisplay, costForecastToDisplay, revenueForecastToDisplay } from '@/lib/currency-display'
import {
  selectCapitalForecast,
  selectCostForecast,
  selectForecast,
  useProjectStore,
} from '@/store/project-store'
import { CapitalKpiBand } from './capital-kpi-band'
import { DashboardControls } from './dashboard-controls'
import { FinanceKpiBand } from './finance-kpi-band'
import { SchoolCapacityKpiBand } from './school-capacity-kpi-band'
import { StudentsKpiBand } from './students-kpi-band'

export interface ComparisonTarget {
  label: string
  forecast: Forecast | null
  costForecast: CostForecast | null
  capitalForecast: CapitalForecast | null
  /** Index into the comparison forecast's `years` array, or null when no comparison year is available. */
  yearIndex: number | null
}

const NO_COMPARISON: ComparisonTarget = {
  label: 'No comparison',
  forecast: null,
  costForecast: null,
  capitalForecast: null,
  yearIndex: null,
}

export function DashboardOverview({
  project,
  forecast,
  costForecast,
  capitalForecast,
  showUsd,
}: {
  project: Project
  forecast: Forecast
  costForecast: CostForecast
  capitalForecast: CapitalForecast
  showUsd: boolean
}) {
  const [yearIndex, setYearIndex] = useState(0)
  const [comparisonSelection, setComparisonSelection] = useState('priorYear')
  const [drilldown, setDrilldown] = useState<DrilldownContent | null>(null)

  useEffect(() => {
    if (yearIndex > forecast.years.length - 1) setYearIndex(Math.max(0, forecast.years.length - 1))
  }, [forecast.years.length, yearIndex])

  const scenarios = useProjectStore((state) => state.scenarios)
  const allProjects = useProjectStore((state) => state.projects)
  const costModels = useProjectStore((state) => state.costModels)
  const capitalModels = useProjectStore((state) => state.capitalModels)

  const scenarioOptions = useMemo(
    () =>
      Object.entries(scenarios)
        .filter(([, meta]) => meta.baseProjectId === project.id)
        .map(([id, meta]) => ({ id, name: meta.name })),
    [scenarios, project.id],
  )

  useEffect(() => {
    if (comparisonSelection === 'priorYear') return
    if (!scenarioOptions.some((option) => option.id === comparisonSelection)) setComparisonSelection('priorYear')
  }, [scenarioOptions, comparisonSelection])

  const comparison: ComparisonTarget = useMemo(() => {
    if (comparisonSelection === 'priorYear') {
      const priorIndex = yearIndex - 1
      if (priorIndex < 0) return NO_COMPARISON
      return {
        label: forecast.years[priorIndex]?.label ?? 'Prior year',
        forecast,
        costForecast,
        capitalForecast: null,
        yearIndex: priorIndex,
      }
    }

    const scenarioMeta = scenarios[comparisonSelection]
    const scenarioProject = allProjects[comparisonSelection]
    const scenarioCost = costModels[comparisonSelection]
    const scenarioCapital = capitalModels[comparisonSelection]
    if (!scenarioMeta || !scenarioProject || !scenarioCost || !scenarioCapital) return NO_COMPARISON

    const rawForecast = selectForecast(scenarioProject)
    const rawCostForecast = selectCostForecast(scenarioProject, scenarioCost)
    const rawCapitalForecast = selectCapitalForecast(scenarioProject, scenarioCost, scenarioCapital)

    return {
      label: scenarioMeta.name,
      forecast: revenueForecastToDisplay(rawForecast, scenarioProject.meta, showUsd),
      costForecast: costForecastToDisplay(rawCostForecast, scenarioProject.meta, showUsd),
      capitalForecast: capitalForecastToDisplay(rawCapitalForecast, scenarioProject.meta, showUsd),
      yearIndex,
    }
  }, [comparisonSelection, yearIndex, forecast, costForecast, scenarios, allProjects, costModels, capitalModels, showUsd])

  return (
    <div className="flex flex-col gap-6">
      <DashboardControls
        forecast={forecast}
        yearIndex={yearIndex}
        onYearIndexChange={setYearIndex}
        comparisonSelection={comparisonSelection}
        onComparisonSelectionChange={setComparisonSelection}
        scenarios={scenarioOptions}
      />
      <StudentsKpiBand
        project={project}
        forecast={forecast}
        yearIndex={yearIndex}
        comparison={comparison}
        onOpenDrilldown={setDrilldown}
      />
      <SchoolCapacityKpiBand
        project={project}
        forecast={forecast}
        yearIndex={yearIndex}
        comparison={comparison}
        onOpenDrilldown={setDrilldown}
      />
      <FinanceKpiBand
        project={project}
        forecast={forecast}
        costForecast={costForecast}
        yearIndex={yearIndex}
        comparison={comparison}
        onOpenDrilldown={setDrilldown}
      />
      <CapitalKpiBand
        project={project}
        costForecast={costForecast}
        capitalForecast={capitalForecast}
        comparison={comparison}
        onOpenDrilldown={setDrilldown}
      />
      <CellDrilldownDialog content={drilldown} onOpenChange={(open) => !open && setDrilldown(null)} />
    </div>
  )
}
