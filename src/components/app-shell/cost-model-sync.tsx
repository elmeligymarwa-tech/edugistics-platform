'use client'

import { useEffect } from 'react'

import { useHasHydrated, useProjectStore } from '@/store/project-store'

/**
 * Backfills a cost model and a capital model for any project that doesn't
 * have one yet — legacy projects persisted before those models existed, or a
 * project restored from an import. Gated on hasHydrated so it never races the
 * async IndexedDB read, the same way the setup wizard gates auto-creating a
 * project on hasHydrated.
 */
export function CostModelSync() {
  const hasHydrated = useHasHydrated()
  const projects = useProjectStore((state) => state.projects)
  const costModels = useProjectStore((state) => state.costModels)
  const capitalModels = useProjectStore((state) => state.capitalModels)
  const ensureCostModel = useProjectStore((state) => state.ensureCostModel)
  const ensureCapitalModel = useProjectStore((state) => state.ensureCapitalModel)

  useEffect(() => {
    if (!hasHydrated) return
    for (const id of Object.keys(projects)) {
      if (!costModels[id]) ensureCostModel(id)
      if (!capitalModels[id]) ensureCapitalModel(id)
    }
  }, [hasHydrated, projects, costModels, capitalModels, ensureCostModel, ensureCapitalModel])

  return null
}
