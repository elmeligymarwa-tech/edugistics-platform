'use client'

import { useEffect } from 'react'

import { useHasHydrated, useProjectStore } from '@/store/project-store'

/**
 * Backfills a cost model for any project that doesn't have one yet — legacy
 * projects persisted before the cost model existed, or a project restored
 * from an import. Gated on hasHydrated so it never races the async
 * IndexedDB read, the same way the setup wizard gates auto-creating a
 * project on hasHydrated.
 */
export function CostModelSync() {
  const hasHydrated = useHasHydrated()
  const projects = useProjectStore((state) => state.projects)
  const costModels = useProjectStore((state) => state.costModels)
  const ensureCostModel = useProjectStore((state) => state.ensureCostModel)

  useEffect(() => {
    if (!hasHydrated) return
    for (const id of Object.keys(projects)) {
      if (!costModels[id]) ensureCostModel(id)
    }
  }, [hasHydrated, projects, costModels, ensureCostModel])

  return null
}
