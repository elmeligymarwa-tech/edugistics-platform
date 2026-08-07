import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { idbStorage } from './project-store'

/**
 * Column widths and collapsed-group state for every DataGrid instance in the
 * app, keyed by gridId. This is UI preference, not domain data — it must
 * never flow through ProjectSchema/CostModelSchema's schema-versioned merge
 * machinery, so it lives in its own persisted slice rather than on
 * project-store.ts. A lost pixel width or collapsed-group flag is harmless,
 * so there's no migration logic yet beyond the version marker below.
 */

export const GRID_UI_STORAGE_NAME = 'edugistics-grid-ui'
export const GRID_UI_SCHEMA_VERSION = 1

const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

function migrateGridUi(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data
  let migrated = data as Record<string, unknown>
  let version = typeof migrated.schemaVersion === 'number' ? migrated.schemaVersion : 0
  while (version < GRID_UI_SCHEMA_VERSION) {
    const upgrade = MIGRATIONS[version]
    migrated = upgrade ? upgrade(migrated) : migrated
    version += 1
  }
  return { ...migrated, schemaVersion: GRID_UI_SCHEMA_VERSION }
}

interface GridUiState {
  schemaVersion: number
  columnWidths: Record<string, Record<string, number>>
  collapsedGroups: Record<string, string[]>
  /** Whether a grid's "secondary" columns (hidden by default behind a "Show more columns" toggle) are shown. */
  showSecondaryColumns: Record<string, boolean>
  setColumnWidth: (gridId: string, columnId: string, width: number) => void
  setColumnWidths: (gridId: string, widths: Record<string, number>) => void
  toggleGroupCollapsed: (gridId: string, groupId: string) => void
  setShowSecondaryColumns: (gridId: string, show: boolean) => void
}

export const useGridUiStore = create<GridUiState>()(
  persist(
    (set) => ({
      schemaVersion: GRID_UI_SCHEMA_VERSION,
      columnWidths: {},
      collapsedGroups: {},
      showSecondaryColumns: {},

      setColumnWidth: (gridId, columnId, width) =>
        set((state) => ({
          columnWidths: {
            ...state.columnWidths,
            [gridId]: { ...state.columnWidths[gridId], [columnId]: width },
          },
        })),

      setColumnWidths: (gridId, widths) =>
        set((state) => ({
          columnWidths: {
            ...state.columnWidths,
            [gridId]: { ...state.columnWidths[gridId], ...widths },
          },
        })),

      toggleGroupCollapsed: (gridId, groupId) =>
        set((state) => {
          const current = state.collapsedGroups[gridId] ?? []
          const next = current.includes(groupId)
            ? current.filter((id) => id !== groupId)
            : [...current, groupId]
          return { collapsedGroups: { ...state.collapsedGroups, [gridId]: next } }
        }),

      setShowSecondaryColumns: (gridId, show) =>
        set((state) => ({ showSecondaryColumns: { ...state.showSecondaryColumns, [gridId]: show } })),
    }),
    {
      name: GRID_UI_STORAGE_NAME,
      storage: createJSONStorage(() => idbStorage),
      merge: (persistedState, currentState) => {
        const persisted = migrateGridUi(persistedState) as Partial<GridUiState> | null
        if (!persisted) return currentState
        return {
          ...currentState,
          columnWidths: persisted.columnWidths ?? currentState.columnWidths,
          collapsedGroups: persisted.collapsedGroups ?? currentState.collapsedGroups,
          showSecondaryColumns: persisted.showSecondaryColumns ?? currentState.showSecondaryColumns,
        }
      },
    },
  ),
)

// Stable empty references — useSyncExternalStore requires getSnapshot to
// return the same value when state hasn't changed; a fresh `{}`/`[]` literal
// on every call causes an infinite render loop.
const EMPTY_WIDTHS: Record<string, number> = {}
const EMPTY_GROUPS: string[] = []

/** Reads persisted widths for a grid, falling back to each column's default. */
export function useGridColumnWidths(gridId: string): Record<string, number> {
  return useGridUiStore((state) => state.columnWidths[gridId] ?? EMPTY_WIDTHS)
}

export function useGridCollapsedGroups(gridId: string): string[] {
  return useGridUiStore((state) => state.collapsedGroups[gridId] ?? EMPTY_GROUPS)
}
