import { orderedYearGroups, type Project } from '@/domain/schema'
import type { CostModel } from '@/domain/costs'
import { interpolateFeeLadderForProject } from '@/lib/egp-fee-bands'
import { useProjectStore } from '@/store/project-store'
import type { Preset, PresetPatch } from './preset-schema'

/** Exported for reuse by the AI consultant's patch-apply logic, which shares this same additive-merge shape. */
export function mergeAmounts(
  existing: Record<string, Record<string, number>>,
  incoming: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const merged: Record<string, Record<string, number>> = { ...existing }
  for (const [group, byCategory] of Object.entries(incoming)) {
    merged[group] = { ...merged[group], ...byCategory }
  }
  return merged
}

/**
 * Applies a preset to a project as a starting point, one call per section
 * through the same store actions the grids use — never a raw object
 * replace, so it can never clobber fields the user already entered.
 * Categories and positions get fresh ids so re-applying, or applying to a
 * project that already has data, only ever adds rather than collides.
 */
export function applyPreset(preset: Preset, project: Project): void {
  const store = useProjectStore.getState()
  const { patch } = preset

  if (patch.fees) {
    const categoryIdMap = new Map<string, string>()
    const categories = patch.fees.categories.map((category) => {
      const freshId = globalThis.crypto.randomUUID()
      categoryIdMap.set(category.id, freshId)
      return { ...category, id: freshId }
    })

    const incomingAmounts: Record<string, Record<string, number>> = {}

    if (patch.fees.feePositioning) {
      const ladder = interpolateFeeLadderForProject(project, patch.fees.feePositioning)
      const tuitionCategory = categories.find((category) => category.escalationGroup === 'tuition')
      if (tuitionCategory) {
        for (const group of orderedYearGroups(project)) {
          incomingAmounts[group] = { [tuitionCategory.id]: ladder[group] }
        }
      }
    } else if (patch.fees.amounts) {
      for (const [group, byCategory] of Object.entries(patch.fees.amounts)) {
        const remapped: Record<string, number> = {}
        for (const [sourceCategoryId, value] of Object.entries(byCategory)) {
          const freshId = categoryIdMap.get(sourceCategoryId)
          if (freshId) remapped[freshId] = value
        }
        incomingAmounts[group] = remapped
      }
    }

    store.updateFees(project.id, {
      categories: [...project.fees.categories, ...categories],
      amounts: mergeAmounts(project.fees.amounts, incomingAmounts),
    })
  }

  if (patch.staffing) {
    const positions = patch.staffing.positions.map((source) => ({ ...source, id: globalThis.crypto.randomUUID() }))
    store.updateStaffing(project.id, { positions: [...project.staffing.positions, ...positions] })
  }

  if (patch.opex) {
    store.ensureCostModel(project.id)
    const costModel = useProjectStore.getState().costModels[project.id]
    const items = patch.opex.map((source) => ({ ...source, id: globalThis.crypto.randomUUID() }))
    store.updateOpex(project.id, [...(costModel?.opex ?? []), ...items])
  }

  if (patch.revenueAssumptions) {
    store.updateRevenueAssumptions(project.id, patch.revenueAssumptions)
  }
}

/** Snapshots the current project (and cost model) into a reusable preset patch, for "save current setup as preset". Derived staffing positions are excluded — they regenerate from capacity on whatever project the preset is next applied to. */
export function captureProjectAsPreset(project: Project, costModel: CostModel | null): PresetPatch {
  const patch: PresetPatch = {
    fees: {
      categories: project.fees.categories,
      amounts: project.fees.amounts,
    },
    staffing: {
      positions: project.staffing.positions.filter((position) => !position.derivedFromCapacity),
    },
  }

  if (costModel && costModel.opex.length > 0) patch.opex = costModel.opex

  const { tuitionEscalationPct, otherFeeEscalationPct } = project.revenueAssumptions
  patch.revenueAssumptions = {
    tuitionEscalationPct: typeof tuitionEscalationPct === 'number' ? tuitionEscalationPct : undefined,
    otherFeeEscalationPct: typeof otherFeeEscalationPct === 'number' ? otherFeeEscalationPct : undefined,
  }

  return patch
}
