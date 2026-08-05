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
import {
  CostModelSchema,
  COST_SCHEMA_VERSION,
  createEmptyCostModel,
  type CostModel,
  type PayrollConfig,
  type OpexCategory,
  type CapexItem,
  type Financing,
} from '../domain/costs'
import { computeCostForecast, type CostForecast } from '../engine/costs'

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

/** Per-version upgrade steps for the cost model, keyed by the schemaVersion they upgrade *from*. */
const MIGRATIONS_COST: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

/** Upgrades a raw cost model object to the current COST_SCHEMA_VERSION. */
export function migrateCostModel(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data
  let migrated = data as Record<string, unknown>
  let version = typeof migrated.schemaVersion === 'number' ? migrated.schemaVersion : 0
  while (version < COST_SCHEMA_VERSION) {
    const upgrade = MIGRATIONS_COST[version]
    migrated = upgrade ? upgrade(migrated) : migrated
    version += 1
  }
  return { ...migrated, schemaVersion: COST_SCHEMA_VERSION }
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

/**
 * A scenario is a duplicated Project + CostModel with a name and a pointer
 * back to the project it was branched from. schema.ts is locked, so this
 * lineage lives only in the store, keyed by the scenario's own project id —
 * never as a field on Project itself.
 */
export interface ScenarioMeta {
  baseProjectId: string
  name: string
  createdAt: string
}

export interface ScenarioAdjustments {
  occupancyDeltaPct?: number
  feeEscalationDeltaPct?: number
  salaryEscalationDeltaPct?: number
  discountDeltaPct?: number
  /** Percent of current headcount, e.g. 110 scales manually-set headcounts up 10%. */
  headcountScalePct?: number
}

interface PersistedProjectState {
  projects: Record<string, Project>
  costModels: Record<string, CostModel>
  scenarios: Record<string, ScenarioMeta>
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
  ensureCostModel: (id: string) => void
  updatePayrollConfig: (id: string, patch: Partial<PayrollConfig>) => void
  updateOpex: (id: string, categories: OpexCategory[]) => void
  updateCapex: (id: string, items: CapexItem[]) => void
  updateFinancing: (id: string, patch: Partial<Financing>) => void
  createScenario: (baseProjectId: string, name: string) => string
  applyScenarioAdjustments: (id: string, adjustments: ScenarioAdjustments) => void
}

export type ProjectStoreState = PersistedProjectState & HydrationState & ProjectActions

const EMPTY_CAPACITY: YearGroupCapacity = {
  classrooms: 0,
  studentsPerClassroom: 0,
  teachers: 0,
  teachingAssistants: 0,
  coTeachers: 0,
  maxCapacityPct: 100,
  maxStudents: null,
  openFromYearIndex: 0,
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

/** Clones a project and its cost model under a fresh id, with a given school name. Shared by duplicateProject and createScenario. */
function cloneProjectAndCost(
  source: Project,
  sourceCost: CostModel | undefined,
  schoolName: string,
  now: string,
): { project: Project; costModel: CostModel } {
  const project = ProjectSchema.parse({
    ...source,
    id: globalThis.crypto.randomUUID(),
    meta: { ...source.meta, schoolName },
    createdAt: now,
    updatedAt: now,
  })
  const costModel = CostModelSchema.parse({
    ...(sourceCost ?? createEmptyCostModel(source.id, now)),
    projectId: project.id,
    createdAt: now,
    updatedAt: now,
  })
  return { project, costModel }
}

/** Adds a delta to a scalar-or-per-year escalation figure, preserving its shape. */
function applyDelta(value: number | number[], delta: number): number | number[] {
  return Array.isArray(value) ? value.map((entry) => entry + delta) : value + delta
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function touchCost<K extends keyof CostModel>(
  costModels: Record<string, CostModel>,
  id: string,
  key: K,
  value: CostModel[K],
): Record<string, CostModel> {
  const existing = costModels[id]
  if (!existing) return costModels
  return {
    ...costModels,
    [id]: { ...existing, [key]: value, updatedAt: new Date().toISOString() },
  }
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      projects: {},
      costModels: {},
      scenarios: {},
      activeProjectId: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      createProject: (schoolName) => {
        const project = createEmptyProject({ schoolName })
        const now = project.createdAt
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          costModels: { ...state.costModels, [project.id]: createEmptyCostModel(project.id, now) },
          activeProjectId: project.id,
        }))
        return project.id
      },

      duplicateProject: (id) => {
        const source = get().projects[id]
        if (!source) throw new Error(`Project not found: ${id}`)
        const now = new Date().toISOString()
        const { project: clone, costModel: cloneCost } = cloneProjectAndCost(
          source,
          get().costModels[id],
          `${source.meta.schoolName} (copy)`,
          now,
        )
        set((state) => ({
          projects: { ...state.projects, [clone.id]: clone },
          costModels: { ...state.costModels, [clone.id]: cloneCost },
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
          const costModels = Object.fromEntries(
            Object.entries(state.costModels).filter(([projectId]) => projectId !== id),
          )
          const scenarios = Object.fromEntries(
            Object.entries(state.scenarios).filter(([scenarioId]) => scenarioId !== id),
          )
          const activeProjectId =
            state.activeProjectId === id
              ? (Object.keys(projects)[0] ?? null)
              : state.activeProjectId
          return { projects, costModels, scenarios, activeProjectId }
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

      ensureCostModel: (id) =>
        set((state) => {
          if (!state.projects[id] || state.costModels[id]) return state
          return {
            costModels: {
              ...state.costModels,
              [id]: createEmptyCostModel(id, new Date().toISOString()),
            },
          }
        }),

      updatePayrollConfig: (id, patch) =>
        set((state) => {
          const cost = state.costModels[id]
          if (!cost) return state
          return {
            costModels: touchCost(state.costModels, id, 'payroll', { ...cost.payroll, ...patch }),
          }
        }),

      updateOpex: (id, categories) =>
        set((state) => {
          const cost = state.costModels[id]
          if (!cost) return state
          return { costModels: touchCost(state.costModels, id, 'opex', categories) }
        }),

      updateCapex: (id, items) =>
        set((state) => {
          const cost = state.costModels[id]
          if (!cost) return state
          return { costModels: touchCost(state.costModels, id, 'capex', items) }
        }),

      updateFinancing: (id, patch) =>
        set((state) => {
          const cost = state.costModels[id]
          if (!cost) return state
          return {
            costModels: touchCost(state.costModels, id, 'financing', {
              ...cost.financing,
              ...patch,
            }),
          }
        }),

      createScenario: (baseProjectId, name) => {
        const source = get().projects[baseProjectId]
        if (!source) throw new Error(`Project not found: ${baseProjectId}`)
        const now = new Date().toISOString()
        const { project: scenarioProject, costModel: scenarioCost } = cloneProjectAndCost(
          source,
          get().costModels[baseProjectId],
          name,
          now,
        )
        set((state) => ({
          projects: { ...state.projects, [scenarioProject.id]: scenarioProject },
          costModels: { ...state.costModels, [scenarioProject.id]: scenarioCost },
          scenarios: {
            ...state.scenarios,
            [scenarioProject.id]: { baseProjectId, name, createdAt: now },
          },
          activeProjectId: scenarioProject.id,
        }))
        return scenarioProject.id
      },

      applyScenarioAdjustments: (id, adjustments) =>
        set((state) => {
          const project = state.projects[id]
          const cost = state.costModels[id]
          if (!project || !cost) return state

          const {
            occupancyDeltaPct = 0,
            feeEscalationDeltaPct = 0,
            salaryEscalationDeltaPct = 0,
            discountDeltaPct = 0,
            headcountScalePct = 100,
          } = adjustments

          const capacity = Object.fromEntries(
            Object.entries(project.capacity).map(([group, groupCapacity]) => [
              group,
              {
                ...groupCapacity,
                occupancyPctByYear: groupCapacity.occupancyPctByYear.map((pct) =>
                  clampPct(pct + occupancyDeltaPct),
                ),
              },
            ]),
          )

          const revenueAssumptions = {
            ...project.revenueAssumptions,
            tuitionEscalationPct: applyDelta(
              project.revenueAssumptions.tuitionEscalationPct,
              feeEscalationDeltaPct,
            ),
            otherFeeEscalationPct: applyDelta(
              project.revenueAssumptions.otherFeeEscalationPct,
              feeEscalationDeltaPct,
            ),
            discounts: {
              ...project.revenueAssumptions.discounts,
              siblingPct: clampPct(project.revenueAssumptions.discounts.siblingPct + discountDeltaPct),
              staffChildPct: clampPct(project.revenueAssumptions.discounts.staffChildPct + discountDeltaPct),
              scholarshipPct: clampPct(
                project.revenueAssumptions.discounts.scholarshipPct + discountDeltaPct,
              ),
              earlyPaymentPct: clampPct(
                project.revenueAssumptions.discounts.earlyPaymentPct + discountDeltaPct,
              ),
            },
          }

          const positions = project.staffing.positions.map((position) => {
            const isManual = !position.derivedFromCapacity || position.manualOverride
            return isManual
              ? { ...position, headcount: Math.max(0, Math.round((position.headcount * headcountScalePct) / 100)) }
              : position
          })

          const now = new Date().toISOString()
          const projects = {
            ...state.projects,
            [id]: {
              ...project,
              capacity,
              revenueAssumptions,
              staffing: { ...project.staffing, positions },
              updatedAt: now,
            },
          }

          const costModels = {
            ...state.costModels,
            [id]: {
              ...cost,
              payroll: {
                ...cost.payroll,
                defaultIncrementPct: applyDelta(cost.payroll.defaultIncrementPct, salaryEscalationDeltaPct),
              },
              updatedAt: now,
            },
          }

          return { projects, costModels }
        }),

      exportProject: (id) => {
        const project = get().projects[id]
        if (!project) throw new Error(`Project not found: ${id}`)
        const costModel = get().costModels[id] ?? createEmptyCostModel(id, project.updatedAt)
        return JSON.stringify({ project, costModel })
      },

      importProject: (json) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(json)
        } catch {
          return { ok: false, error: 'Invalid JSON' }
        }

        const envelope =
          typeof parsed === 'object' && parsed !== null && 'project' in parsed
            ? (parsed as { project: unknown; costModel?: unknown })
            : { project: parsed, costModel: undefined }

        const projectResult = ProjectSchema.safeParse(migrateProject(envelope.project))
        if (!projectResult.success) {
          return { ok: false, error: projectResult.error.message }
        }

        const now = new Date().toISOString()
        const project: Project = {
          ...projectResult.data,
          id: globalThis.crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        }

        let costModel: CostModel
        if (envelope.costModel) {
          const costResult = CostModelSchema.safeParse(migrateCostModel(envelope.costModel))
          if (!costResult.success) {
            return { ok: false, error: costResult.error.message }
          }
          costModel = { ...costResult.data, projectId: project.id, createdAt: now, updatedAt: now }
        } else {
          costModel = createEmptyCostModel(project.id, now)
        }

        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          costModels: { ...state.costModels, [project.id]: costModel },
          activeProjectId: project.id,
        }))
        return { ok: true, id: project.id }
      },
    }),
    {
      name: STORAGE_NAME,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        projects: state.projects,
        costModels: state.costModels,
        scenarios: state.scenarios,
        activeProjectId: state.activeProjectId,
      }),
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
        const costModels = Object.fromEntries(
          Object.entries(persisted.costModels ?? {}).map(([id, costModel]) => [
            id,
            CostModelSchema.parse(migrateCostModel(costModel)),
          ]),
        )
        return {
          ...currentState,
          projects,
          costModels,
          scenarios: persisted.scenarios ?? currentState.scenarios,
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

const costForecastCache = new WeakMap<Project, WeakMap<CostModel, CostForecast>>()

/** Memoises computeCostForecast against the identity of both the project and its cost model. */
export function selectCostForecast(project: Project, cost: CostModel): CostForecast {
  let byCost = costForecastCache.get(project)
  if (!byCost) {
    byCost = new WeakMap()
    costForecastCache.set(project, byCost)
  }
  const cached = byCost.get(cost)
  if (cached) return cached
  const forecast = computeCostForecast(project, cost, selectForecast(project))
  byCost.set(cost, forecast)
  return forecast
}

export function useCostModel(id: string): CostModel | null {
  return useProjectStore((state) => state.costModels[id] ?? null)
}

export function useProjectCostForecast(id: string): CostForecast | null {
  const project = useProjectStore((state) => state.projects[id])
  const cost = useProjectStore((state) => state.costModels[id])
  return project && cost ? selectCostForecast(project, cost) : null
}
