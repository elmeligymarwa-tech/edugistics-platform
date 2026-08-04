'use client'

import { useState } from 'react'

import type { Project } from '@/domain/schema'
import type { Forecast } from '@/engine/revenue'
import { ChartEnrolmentGrowth } from './chart-enrolment-growth'
import { ChartGrossNetCollected } from './chart-gross-net-collected'
import { ChartRevenueByYear } from './chart-revenue-by-year'
import { ChartRevenueMix } from './chart-revenue-mix'
import { ForecastTable } from './forecast-table'
import { SummaryCards } from './summary-cards'
import { YearSelector } from './year-selector'

export function RevenuePlanner({ project, forecast }: { project: Project; forecast: Forecast }) {
  const [selectedYearIndex, setSelectedYearIndex] = useState(0)
  const selectedYear = forecast.years[selectedYearIndex] ?? forecast.years[0]

  return (
    <div className="flex flex-col gap-6">
      <YearSelector forecast={forecast} selectedYearIndex={selectedYearIndex} onChange={setSelectedYearIndex} />

      {selectedYear ? <SummaryCards project={project} year={selectedYear} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartRevenueByYear project={project} forecast={forecast} />
        <ChartRevenueMix project={project} forecast={forecast} />
        <ChartEnrolmentGrowth project={project} forecast={forecast} />
        <ChartGrossNetCollected project={project} forecast={forecast} />
      </div>

      <ForecastTable project={project} forecast={forecast} />
    </div>
  )
}
