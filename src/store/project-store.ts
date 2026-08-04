import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import {
  ProjectSchema,
  SCHEMA_VERSION,
  type Project,
  type ProjectMeta,
  type CalendarConfig,
  type YearGroupId,
  type YearGroupCapacity,
  type FeeStructure,
  type RevenueAssumptions,
  type StaffingConfig,
  type StmAgreement,
} from '../domain/schema'
import { computeForecast, type Forecast } from '../engine/revenue'

export const STORAGE_NAME = 'edugistics-projects'
const DEBOUNCE_MS = 500

/* ------------------------------------------------------------ migration */

/** Per-version upgrade steps, keyed by the schemaVersion they upgrade *from*. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

/** Upgrades a raw project object to the current schemaVersion. */
export function migrateProject(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data
  let migrated = data as Record<string, unknown>
  let version = typeof migrated.schemaVersion === 'number' ? migrated.schemaVersion : 0
  while (version < SCHEMA_VERSION) {
    const upgrade = MIGRATIONS[version]
    migrated = upgrade ? upgrade(migrated) : migrated
    version += 1
  }
  return { ...migrated, schemaVersion: SCHEMA_VERSION }
}

/* ---------------------------------------------------------------- empty */

export function createEmptyProject(input: { schoolName?: string; id?: string } = {}): Project {
  const now = new Date().toISOString()
  return ProjectSchema.parse({
    id: input.id ?? globalThis.crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    meta: {
      schoolName: input.schoolName ?? 'New project',
      country: 'United Kingdom',
      currencyCode: 'GBP',
      currencySymbol: '£',
    },
    calendar: {
      academicYearStart: new Date().getFullYear(),
      financialYearStartMonth: 9,
      forecastYears: 5,
    },
    yearGroups: [],
    capacity: {},
    fees: { categories: [], amounts: {} },
    revenueAssumptions: {
      discounts: {},
      collections: { termSplit: [100] },
    },
    staffing: {},
    createdAt: now,
    updatedAt: now,
  })
}

/* ------------------------------------------------------------ save status */

interface SaveStatusState {
  status: 'idle' | 'pending' | 'saved'
  lastSavedAt: string | null
  markPending: () => void
  markSaved: (at: string) => void
}

/** Tracks the real IndexedDB write, not just the in-memory state change. */
export const useSaveStatus = create<SaveStatusState>((set) => ({
  status: 'idle',
  lastSavedAt: null,
  markPending: () => set({ status: 'pending' }),
  markSaved: (at) => set({ status: 'saved', lastSavedAt: at }),
}))

/* -------------------------------------------------------- idb-keyval storage */

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function debounce(fn: (name: string, value: string) => void, ms: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  return (name: string, value: string) => {
    const pending = timers.get(name)
    if (pending) clearTimeout(pending)
    timers.set(
      name,
      setTimeout(() => {
        timers.delete(name)
        fn(name, value)
      }, ms),
    )
  }
}

const debouncedIdbSet = debounce((name, value) => {
  void idbSet(name, value).then(() => {
    useSaveStatus.getState().markSaved(new Date().toISOString())
  })
}, DEBOUNCE_MS)

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIndexedDb()) return null
    return (await idbGet<string>(name)) ?? null
  },
  setItem: (name, value) => {
    if (!hasIndexedDb()) return
    useSaveStatus.getState().markPending()
    debouncedIdbSet(name, value)
  },
  removeItem: async (name) => {
    if (!hasIndexedDb()) return
    await idbDel(name)
  },
}

/* ----------------------------------------------------------------- store */

interface PersistedProjectState {
  projects: Record<string, Project>
  activeProjectId: string | null
}

export type ProjectImportResult = { ok: true; id: string } | { ok: false; error: string }

interface HydrationState {
  /** False until IndexedDB rehydration has resolved (or failed). Gates any logic that would otherwise race the async read, such as auto-creating a project when none is active yet. */
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
}

interface ProjectActions {
  createProject: (schoolName?: string) => string
  duplicateProject: (id: string) => string
  renameProject: (id: string, schoolName: string) => void
  deleteProject: (id: string) => void
  setActiveProject: (id: string) => void
  updateMeta: (id: string, patch: Partial<ProjectMeta>) => void
  updateCalendar: (id: string, patch: Partial<CalendarConfig>) => void
  updateYearGroups: (id: string, yearGroups: YearGroupId[]) => void
  /** Removes a year group and any capacity, fee, intake and retention data tied to it. */
  removeYearGroup: (id: string, yearGroup: YearGroupId) => void
  updateCapacity: (id: string, yearGroup: YearGroupId, patch: Partial<YearGroupCapacity>) => void
  updateFees: (id: string, patch: Partial<FeeStructure>) => void
  updateRevenueAssumptions: (id: string, patch: Partial<RevenueAssumptions>) => void
  updateStaffing: (id: string, patch: Partial<StaffingConfig>) => void
  updateStm: (id: string, stm: StmAgreement | null) => void
  exportProject: (id: string) => string
  importProject: (json: string) => ProjectImportResult
}

export type ProjectStoreState = PersistedProjectState & HydrationState & ProjectActions

const EMPTY_CAPACITY: YearGroupCapacity = {
  classrooms: 0,
  studentsPerClassroom: 0,
  teachers: 0,
  teachingAssistants: 0,
  coTeachers: 0,
  maxCapacityPct: 100,
  occupancyPctByYear: [],
}

function touch<K extends keyof Project>(
  projects: Record<string, Project>,
  id: string,
  key: K,
  value: Project[K],
): Record<string, Project> {
  const existing = projects[id]
  if (!existing) return projects
  return {
    ...projects,
    [id]: { ...existing, [key]: value, updatedAt: new Date().toISOString() },
  }
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      projects: {},
      activeProjectId: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      createProject: (schoolName) => {
        const project = createEmptyProject({ schoolName })
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          activeProjectId: project.id,
        }))
        return project.id
      },

      duplicateProject: (id) => {
        const source = get().projects[id]
        if (!source) throw new Error(`Project not found: ${id}`)
        const now = new Date().toISOString()
        const clone = ProjectSchema.parse({
          ...source,
          id: globalThis.crypto.randomUUID(),
          meta: { ...source.meta, schoolName: `${source.meta.schoolName} (copy)` },
          createdAt: now,
          updatedAt: now,
        })
        set((state) => ({
          projects: { ...state.projects, [clone.id]: clone },
          activeProjectId: clone.id,
        }))
        return clone.id
      },

      renameProject: (id, schoolName) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return { projects: touch(state.projects, id, 'meta', { ...project.meta, schoolName }) }
        }),

      deleteProject: (id) =>
        set((state) => {
          const projects = Object.fromEntries(
            Object.entries(state.projects).filter(([projectId]) => projectId !== id),
          )
          const activeProjectId =
            state.activeProjectId === id
              ? (Object.keys(projects)[0] ?? null)
              : state.activeProjectId
          return { projects, activeProjectId }
        }),

      setActiveProject: (id) =>
        set((state) => (state.projects[id] ? { activeProjectId: id } : state)),

      updateMeta: (id, patch) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return { projects: touch(state.projects, id, 'meta', { ...project.meta, ...patch }) }
        }),

      updateCalendar: (id, patch) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return {
            projects: touch(state.projects, id, 'calendar', { ...project.calendar, ...patch }),
          }
        }),

      updateYearGroups: (id, yearGroups) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return { projects: touch(state.projects, id, 'yearGroups', yearGroups) }
        }),

      removeYearGroup: (id, yearGroup) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state

          const capacity = { ...project.capacity }
          delete capacity[yearGroup]

          const amounts = { ...project.fees.amounts }
          delete amounts[yearGroup]

          const newIntake = { ...project.revenueAssumptions.newIntake }
          delete newIntake[yearGroup]

          const retentionPct = { ...project.revenueAssumptions.retentionPct }
          delete retentionPct[yearGroup]

          return {
            projects: {
              ...state.projects,
              [id]: {
                ...project,
                yearGroups: project.yearGroups.filter((g) => g !== yearGroup),
                capacity,
                fees: { ...project.fees, amounts },
                revenueAssumptions: { ...project.revenueAssumptions, newIntake, retentionPct },
                updatedAt: new Date().toISOString(),
              },
            },
          }
        }),

      updateCapacity: (id, yearGroup, patch) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          const merged: YearGroupCapacity = {
            ...EMPTY_CAPACITY,
            ...project.capacity[yearGroup],
            ...patch,
          }
          return {
            projects: touch(state.projects, id, 'capacity', {
              ...project.capacity,
              [yearGroup]: merged,
            }),
          }
        }),

      updateFees: (id, patch) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return { projects: touch(state.projects, id, 'fees', { ...project.fees, ...patch }) }
        }),

      updateRevenueAssumptions: (id, patch) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return {
            projects: touch(state.projects, id, 'revenueAssumptions', {
              ...project.revenueAssumptions,
              ...patch,
            }),
          }
        }),

      updateStaffing: (id, patch) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return {
            projects: touch(state.projects, id, 'staffing', { ...project.staffing, ...patch }),
          }
        }),

      updateStm: (id, stm) =>
        set((state) => {
          const project = state.projects[id]
          if (!project) return state
          return { projects: touch(state.projects, id, 'stm', stm) }
        }),

      exportProject: (id) => {
        const project = get().projects[id]
        if (!project) throw new Error(`Project not found: ${id}`)
        return JSON.stringify(project)
      },

      importProject: (json) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(json)
        } catch {
          return { ok: false, error: 'Invalid JSON' }
        }

        const result = ProjectSchema.safeParse(migrateProject(parsed))
        if (!result.success) {
          return { ok: false, error: result.error.message }
        }

        const now = new Date().toISOString()
        const project: Project = {
          ...result.data,
          id: globalThis.crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          activeProjectId: project.id,
        }))
        return { ok: true, id: project.id }
      },
    }),
    {
      name: STORAGE_NAME,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ projects: state.projects, activeProjectId: state.activeProjectId }),
      onRehydrateStorage: () => () => {
        useProjectStore.getState().setHasHydrated(true)
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedProjectState> | null
        if (!persisted?.projects) return currentState
        const projects = Object.fromEntries(
          Object.entries(persisted.projects).map(([id, project]) => [
            id,
            ProjectSchema.parse(migrateProject(project)),
          ]),
        )
        return {
          ...currentState,
          projects,
          activeProjectId: persisted.activeProjectId ?? currentState.activeProjectId,
        }
      },
    },
  ),
)

/* ------------------------------------------------------------- selectors */

const forecastCache = new WeakMap<Project, Forecast>()

/** Memoises computeForecast against the project object's identity. */
export function selectForecast(project: Project): Forecast {
  const cached = forecastCache.get(project)
  if (cached) return cached
  const forecast = computeForecast(project)
  forecastCache.set(project, forecast)
  return forecast
}

export function useActiveProject(): Project | null {
  return useProjectStore((state) =>
    state.activeProjectId ? (state.projects[state.activeProjectId] ?? null) : null,
  )
}

/** True once IndexedDB rehydration has resolved. Gate any logic that reacts to an absent active project on this, otherwise it will race the async read and orphan persisted data behind a freshly created empty one. */
export function useHasHydrated(): boolean {
  return useProjectStore((state) => state.hasHydrated)
}

export function useProjectForecast(id: string): Forecast | null {
  const project = useProjectStore((state) => state.projects[id])
  return project ? selectForecast(project) : null
}
