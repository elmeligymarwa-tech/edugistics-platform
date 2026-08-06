import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { idbStorage } from './project-store'

/**
 * UI-only state for the AI consultant, keyed by project id: whether the
 * panel has already auto-opened for a project (so it only ever does that
 * once, not on every navigation), whether the panel is currently
 * open/collapsed, and which field paths were last populated by an accepted
 * AI proposal. AI-populated tracking exists here — not on the LOCKED domain
 * schemas — because those schemas can't gain an `aiPopulated` flag; a field
 * is cleared from this list the moment the user edits it manually via a
 * grid. None of this is domain data, so it lives in its own persisted slice
 * exactly like grid-ui-store.ts.
 */

export const CONSULTANT_UI_STORAGE_NAME = 'edugistics-consultant-ui'
export const CONSULTANT_UI_SCHEMA_VERSION = 1

const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

function migrateConsultantUi(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data
  let migrated = data as Record<string, unknown>
  let version = typeof migrated.schemaVersion === 'number' ? migrated.schemaVersion : 0
  while (version < CONSULTANT_UI_SCHEMA_VERSION) {
    const upgrade = MIGRATIONS[version]
    migrated = upgrade ? upgrade(migrated) : migrated
    version += 1
  }
  return { ...migrated, schemaVersion: CONSULTANT_UI_SCHEMA_VERSION }
}

interface ConsultantUiState {
  schemaVersion: number
  autoOpenedProjectIds: string[]
  panelOpenByProjectId: Record<string, boolean>
  aiPopulatedFieldsByProjectId: Record<string, string[]>
  markAutoOpened: (projectId: string) => void
  setPanelOpen: (projectId: string, open: boolean) => void
  markFieldsAiPopulated: (projectId: string, paths: string[]) => void
  clearAiPopulatedField: (projectId: string, path: string) => void
  clearAiPopulatedFields: (projectId: string) => void
}

export const useConsultantUiStore = create<ConsultantUiState>()(
  persist(
    (set) => ({
      schemaVersion: CONSULTANT_UI_SCHEMA_VERSION,
      autoOpenedProjectIds: [],
      panelOpenByProjectId: {},
      aiPopulatedFieldsByProjectId: {},

      markAutoOpened: (projectId) =>
        set((state) =>
          state.autoOpenedProjectIds.includes(projectId)
            ? state
            : { autoOpenedProjectIds: [...state.autoOpenedProjectIds, projectId] },
        ),

      setPanelOpen: (projectId, open) =>
        set((state) => ({
          panelOpenByProjectId: { ...state.panelOpenByProjectId, [projectId]: open },
        })),

      markFieldsAiPopulated: (projectId, paths) =>
        set((state) => {
          const current = state.aiPopulatedFieldsByProjectId[projectId] ?? []
          const merged = [...new Set([...current, ...paths])]
          return { aiPopulatedFieldsByProjectId: { ...state.aiPopulatedFieldsByProjectId, [projectId]: merged } }
        }),

      clearAiPopulatedField: (projectId, path) =>
        set((state) => {
          const current = state.aiPopulatedFieldsByProjectId[projectId] ?? []
          if (!current.includes(path)) return state
          return {
            aiPopulatedFieldsByProjectId: {
              ...state.aiPopulatedFieldsByProjectId,
              [projectId]: current.filter((existing) => existing !== path),
            },
          }
        }),

      clearAiPopulatedFields: (projectId) =>
        set((state) => ({
          aiPopulatedFieldsByProjectId: { ...state.aiPopulatedFieldsByProjectId, [projectId]: [] },
        })),
    }),
    {
      name: CONSULTANT_UI_STORAGE_NAME,
      storage: createJSONStorage(() => idbStorage),
      merge: (persistedState, currentState) => {
        const persisted = migrateConsultantUi(persistedState) as Partial<ConsultantUiState> | null
        if (!persisted) return currentState
        return {
          ...currentState,
          autoOpenedProjectIds: persisted.autoOpenedProjectIds ?? currentState.autoOpenedProjectIds,
          panelOpenByProjectId: persisted.panelOpenByProjectId ?? currentState.panelOpenByProjectId,
          aiPopulatedFieldsByProjectId:
            persisted.aiPopulatedFieldsByProjectId ?? currentState.aiPopulatedFieldsByProjectId,
        }
      },
    },
  ),
)

// Stable empty reference — useSyncExternalStore requires getSnapshot to
// return the same value when state hasn't changed; a fresh `[]` literal on
// every call causes an infinite render loop.
const EMPTY_PATHS: string[] = []

export function useHasAutoOpened(projectId: string): boolean {
  return useConsultantUiStore((state) => state.autoOpenedProjectIds.includes(projectId))
}

export function useIsPanelOpen(projectId: string): boolean {
  return useConsultantUiStore((state) => state.panelOpenByProjectId[projectId] ?? false)
}

export function useAiPopulatedFields(projectId: string): string[] {
  return useConsultantUiStore((state) => state.aiPopulatedFieldsByProjectId[projectId] ?? EMPTY_PATHS)
}
