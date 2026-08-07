import type { Project } from '@/domain/schema'
import type { OpexCategory } from '@/domain/costs'
import { interpolateFeeLadder } from '@/lib/egp-fee-bands'
import { orderedYearGroups } from '@/domain/schema'
import { useProjectStore } from '@/store/project-store'
import type { ConsultantPatch } from './route-contract'

/** Additive merge, keyed by year group then category id — never drops an existing entry a patch doesn't touch. */
function mergeAmounts(
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
 * Applies an accepted consultant patch section through the same store
 * update actions the grids use — never a raw object replace. Called only
 * from the client, only after the user accepts; the API route never
 * touches the store. Every value has already been safeParse-validated
 * against the real domain schemas server-side.
 */
export function applyConsultantPatch(patch: ConsultantPatch, project: Project): void {
  const store = useProjectStore.getState()

  if (patch.meta) store.updateMeta(project.id, patch.meta)
  if (patch.calendar) store.updateCalendar(project.id, patch.calendar)

  const effectiveYearGroups = patch.yearGroups ?? project.yearGroups
  if (patch.yearGroups) store.updateYearGroups(project.id, patch.yearGroups)

  if (patch.schoolPlan) {
    store.updateRevenueAssumptions(project.id, {
      schoolPlan: { ...project.revenueAssumptions.schoolPlan, ...patch.schoolPlan },
    })
  }

  if (patch.feeCategories || patch.feePositioning) {
    const categories = (patch.feeCategories ?? []).map((category) => ({
      ...category,
      id: globalThis.crypto.randomUUID(),
    }))

    let incomingAmounts: Record<string, Record<string, number>> = {}
    if (patch.feePositioning) {
      const orderedGroups = orderedYearGroups({ ...project, yearGroups: effectiveYearGroups })
      const ladder = interpolateFeeLadder(patch.feePositioning, orderedGroups)
      const tuitionCategory =
        categories.find((category) => category.escalationGroup === 'tuition') ??
        project.fees.categories.find((category) => category.escalationGroup === 'tuition')
      if (tuitionCategory) {
        incomingAmounts = {}
        for (const group of orderedGroups) {
          incomingAmounts[group] = { ...incomingAmounts[group], [tuitionCategory.id]: ladder[group] }
        }
      }
    }

    store.updateFees(project.id, {
      categories: [...project.fees.categories, ...categories],
      amounts: mergeAmounts(project.fees.amounts, incomingAmounts),
    })
  }

  if (patch.staffPositions) {
    const positions = patch.staffPositions.map((position) => ({ ...position, id: globalThis.crypto.randomUUID() }))
    store.updateStaffing(project.id, { positions: [...project.staffing.positions, ...positions] })
  }

  if (patch.opexCategories) {
    store.ensureCostModel(project.id)
    const costModel = useProjectStore.getState().costModels[project.id]
    const items = patch.opexCategories.map((category) => ({ ...category, id: globalThis.crypto.randomUUID() }))
    store.updateOpex(project.id, [...(costModel?.opex ?? []), ...items])
  }
}

/** Snapshot of the project sub-objects a patch would touch, for undo. Shallow-clones just the affected top-level sections. */
export function snapshotForPatch(patch: ConsultantPatch, project: Project, costModelOpex: OpexCategory[]) {
  return {
    meta: patch.meta ? { ...project.meta } : undefined,
    calendar: patch.calendar ? { ...project.calendar } : undefined,
    yearGroups: patch.yearGroups ? [...project.yearGroups] : undefined,
    revenueAssumptions: patch.schoolPlan ? { ...project.revenueAssumptions } : undefined,
    fees: patch.feeCategories || patch.feePositioning ? { ...project.fees } : undefined,
    staffing: patch.staffPositions ? { ...project.staffing } : undefined,
    opex: patch.opexCategories ? [...costModelOpex] : undefined,
  }
}

/** Restores a snapshot taken by snapshotForPatch — the undo path. */
export function restoreSnapshot(
  snapshot: ReturnType<typeof snapshotForPatch>,
  projectId: string,
): void {
  const store = useProjectStore.getState()
  if (snapshot.meta) store.updateMeta(projectId, snapshot.meta)
  if (snapshot.calendar) store.updateCalendar(projectId, snapshot.calendar)
  if (snapshot.yearGroups) store.updateYearGroups(projectId, snapshot.yearGroups)
  if (snapshot.revenueAssumptions) store.updateRevenueAssumptions(projectId, snapshot.revenueAssumptions)
  if (snapshot.fees) store.updateFees(projectId, snapshot.fees)
  if (snapshot.staffing) store.updateStaffing(projectId, snapshot.staffing)
  if (snapshot.opex) store.updateOpex(projectId, snapshot.opex)
}
