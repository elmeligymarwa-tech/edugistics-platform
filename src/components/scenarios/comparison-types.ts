import type { Project } from '@/domain/schema'
import type { CostForecast } from '@/engine/costs'

export interface ComparisonColumn {
  id: string
  label: string
  project: Project
  costForecast: CostForecast
}
