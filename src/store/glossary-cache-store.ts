import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { idbStorage } from './project-store'

/**
 * Caches the AI-generated "explain this figure for this school" text per
 * project and term, so reopening the same term's panel never re-bills the
 * consultant API. UI-only, not domain data — lives in its own persisted
 * slice exactly like consultant-ui-store.ts.
 */

export const GLOSSARY_CACHE_STORAGE_NAME = 'edugistics-glossary-cache'

interface GlossaryCacheState {
  /** explanationsByProjectId[projectId][termId] */
  explanationsByProjectId: Record<string, Record<string, string>>
  setExplanation: (projectId: string, termId: string, explanation: string) => void
  clearProject: (projectId: string) => void
}

export const useGlossaryCacheStore = create<GlossaryCacheState>()(
  persist(
    (set) => ({
      explanationsByProjectId: {},

      setExplanation: (projectId, termId, explanation) =>
        set((state) => ({
          explanationsByProjectId: {
            ...state.explanationsByProjectId,
            [projectId]: { ...state.explanationsByProjectId[projectId], [termId]: explanation },
          },
        })),

      clearProject: (projectId) =>
        set((state) => {
          const next = { ...state.explanationsByProjectId }
          delete next[projectId]
          return { explanationsByProjectId: next }
        }),
    }),
    {
      name: GLOSSARY_CACHE_STORAGE_NAME,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
)

export function useCachedExplanation(projectId: string | undefined, termId: string): string | null {
  return useGlossaryCacheStore((state) =>
    projectId ? (state.explanationsByProjectId[projectId]?.[termId] ?? null) : null,
  )
}
