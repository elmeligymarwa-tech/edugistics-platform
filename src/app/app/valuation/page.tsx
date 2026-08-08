'use client'

import { useMemo } from 'react'
import { LineChart } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { ChartTornado } from '@/components/reports/chart-tornado'
import { ChartFreeCashFlow } from '@/components/valuation/chart-free-cash-flow'
import { SensitivityGrid } from '@/components/valuation/sensitivity-grid'
import { ValuationAssumptionsEditor } from '@/components/valuation/valuation-assumptions-editor'
import { ValuationSummaryCards } from '@/components/valuation/valuation-summary-cards'
import { toUsd, tornado } from '@/engine/analysis'
import { capitalForecastToDisplay, toDisplayMeta } from '@/lib/currency-display'
import { buildValuationSensitivityGrid } from '@/lib/sensitivity'
import {
  useActiveProject,
  useCapitalModel,
  useCostModel,
  useHasHydrated,
  useProjectCapitalForecast,
  useProjectCostForecast,
} from '@/store/project-store'
import { useCurrencyDisplayStore } from '@/store/currency-display-store'

export default function ValuationPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()
  const costModel = useCostModel(project?.id ?? '')
  const capitalModel = useCapitalModel(project?.id ?? '')
  const costForecast = useProjectCostForecast(project?.id ?? '')
  const capitalForecast = useProjectCapitalForecast(project?.id ?? '')
  const showUsd = useCurrencyDisplayStore((state) => state.showUsd)

  const displayMeta = project ? toDisplayMeta(project.meta, showUsd) : null
  const displayCapitalForecast =
    project && capitalForecast ? capitalForecastToDisplay(capitalForecast, project.meta, showUsd) : capitalForecast

  const tornadoResult = useMemo(() => {
    if (!project || !costModel || !capitalModel) return null
    const result = tornado(project, costModel, capitalModel)
    if (!showUsd) return result
    return {
      base: toUsd(result.base, project.meta, 0),
      entries: result.entries.map((entry) => ({
        ...entry,
        low: toUsd(entry.low, project.meta, 0),
        high: toUsd(entry.high, project.meta, 0),
        swing: toUsd(entry.swing, project.meta, 0),
      })),
    }
  }, [project, costModel, capitalModel, showUsd])

  const sensitivityGrid = useMemo(() => {
    if (!project || !costModel || !capitalModel || !costForecast) return null
    const grid = buildValuationSensitivityGrid(project, costModel, capitalModel, costForecast)
    if (!showUsd) return grid
    return {
      ...grid,
      equityValues: grid.equityValues.map((row) => row.map((value) => toUsd(value, project.meta, 0))),
    }
  }, [project, costModel, capitalModel, costForecast, showUsd])

  return (
    <>
      <PageHeader title="Valuation" description="Discounted cash flow, returns and sensitivity." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={LineChart}
          title="No project yet"
          description="Complete setup before running a valuation."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {project && costModel && capitalModel && displayCapitalForecast && tornadoResult && sensitivityGrid && displayMeta ? (
        <div className="flex flex-col gap-6">
          <ValuationSummaryCards project={{ ...project, meta: displayMeta }} capitalForecast={displayCapitalForecast} />
          <ValuationAssumptionsEditor projectId={project.id} capital={capitalModel} />
          <ChartFreeCashFlow project={{ ...project, meta: displayMeta }} capitalForecast={displayCapitalForecast} />
          <SensitivityGrid meta={displayMeta} grid={sensitivityGrid} />
          <ChartTornado meta={displayMeta} base={tornadoResult.base} entries={tornadoResult.entries} />
        </div>
      ) : null}
    </>
  )
}
