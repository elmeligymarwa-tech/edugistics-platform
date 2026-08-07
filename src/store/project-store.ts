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
import {
  CapitalModelSchema,
  CAPITAL_SCHEMA_VERSION,
  createEmptyCapitalModel,
  type CapitalModel,
  type Equity,
  type Loan,
  type Valuation,
} from '../domain/capital'
import { computeCapitalForecast, type CapitalForecast } from '../engine/capital'

export const STORAGE_NAME = 'edugistics-projects'
const DEBOUNCE_MS = 500

/* ------------------------------------------------------------ migration */

/** Per-version upgrade steps, keyed by the schemaVersion they upgrade *from*. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

/**
 * The capacity grid dropped "Max capacity %" and the separate "Max students" override —
 * a year group's ceiling is now always classrooms times max students per class. Old
 * projects that relied on either control need that figure folded into
 * studentsPerClassroom once, so the ceiling (and therefore every forecast number
 * downstream of it) doesn't silently change. Separately, the percentage-based
 * school-wide occupancy ramp was replaced by the school plan; any project that had it
 * switched on gets that ramp folded into each open year group's own occupancy array
 * (exactly what it already overrode at read time), then cleared, so per-group Current
 * intake edits aren't silently shadowed by a control that no longer has a UI.
 * Self-guarding — a project that's already been through this is left untouched, so it's
 * a no-op on every load after the first.
 */
function normalizeCapacityInputs(data: Record<string, unknown>): Record<string, unknown> {
  const capacity = data.capacity
  if (typeof capacity !== 'object' || capacity === null) return data

  const revenueAssumptions = data.revenueAssumptions
  const hasRevenueAssumptions = typeof revenueAssumptions === 'object' && revenueAssumptions !== null
  const schoolRamp = hasRevenueAssumptions
    ? (revenueAssumptions as Record<string, unknown>).schoolOccupancyPctByYear
    : undefined
  const schoolRampArray = Array.isArray(schoolRamp) ? (schoolRamp as unknown[]).filter((v) => typeof v === 'number') as number[] : []

  let changed = false
  const nextCapacity: Record<string, unknown> = {}
  for (const [group, entry] of Object.entries(capacity as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) {
      nextCapacity[group] = entry
      continue
    }
    const row = entry as Record<string, unknown>
    const classrooms = typeof row.classrooms === 'number' ? row.classrooms : 0
    const studentsPerClassroom = typeof row.studentsPerClassroom === 'number' ? row.studentsPerClassroom : 0
    const maxCapacityPct = typeof row.maxCapacityPct === 'number' ? row.maxCapacityPct : 100
    const maxStudents = typeof row.maxStudents === 'number' ? row.maxStudents : null

    let nextStudentsPerClassroom = studentsPerClassroom
    let nextMaxStudents: number | null = maxStudents
    let nextMaxCapacityPct = maxCapacityPct
    if (maxStudents !== null || maxCapacityPct !== 100) {
      const ceiling = maxStudents ?? (classrooms * studentsPerClassroom * maxCapacityPct) / 100
      nextStudentsPerClassroom = classrooms > 0 ? Math.max(0, Math.round(ceiling / classrooms)) : studentsPerClassroom
      nextMaxStudents = null
      nextMaxCapacityPct = 100
      changed = true
    }

    let occupancyPctByYear = Array.isArray(row.occupancyPctByYear)
      ? ((row.occupancyPctByYear as unknown[]).filter((v) => typeof v === 'number') as number[])
      : []
    if (schoolRampArray.length > 0) {
      occupancyPctByYear = schoolRampArray
      changed = true
    }

    nextCapacity[group] = {
      ...row,
      studentsPerClassroom: nextStudentsPerClassroom,
      maxStudents: nextMaxStudents,
      maxCapacityPct: nextMaxCapacityPct,
      occupancyPctByYear,
    }
  }

  if (!changed) return data

  const nextData: Record<string, unknown> = { ...data, capacity: nextCapacity }
  if (schoolRampArray.length > 0 && hasRevenueAssumptions) {
    nextData.revenueAssumptions = {
      ...(revenueAssumptions as Record<string, unknown>),
      schoolOccupancyPctByYear: [],
    }
  }
  return nextData
}

/**
 * The staffing grid no longer derives Teachers/Teaching Assistants/Co-Teachers headcount
 * from capacity — every position's headcount is typed directly, and the Auto/Override
 * badge that gated it is gone. A position that was capacity-derived keeps whatever
 * headcount it last computed to (kept fresh, until now, by the sync effect this replaces),
 * so the switch to typed headcount doesn't change a single forecast number; only the
 * derivedFromCapacity/manualOverride flags are cleared. Self-guarding — a no-op once every
 * position has already been cleared.
 */
function normalizeStaffingPositions(data: Record<string, unknown>): Record<string, unknown> {
  const staffing = data.staffing
  if (typeof staffing !== 'object' || staffing === null) return data
  const positions = (staffing as Record<string, unknown>).positions
  if (!Array.isArray(positions)) return data

  let changed = false
  const nextPositions = positions.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return entry
    const position = entry as Record<string, unknown>
    if (position.derivedFromCapacity === false && position.manualOverride === false) return position
    changed = true
    return { ...position, derivedFromCapacity: false, manualOverride: false }
  })

  if (!changed) return data
  return { ...data, staffing: { ...(staffing as Record<string, unknown>), positions: nextPositions } }
}

/**
 * Minimum/maximum salary, pension %, medical insurance %, housing allowance, transport
 * allowance, recruitment cost and training cost dropped out of the staffing grid's visible
 * columns, but the fields stay on StaffPositionSchema and the cost engine still reads them —
 * so a project saved before this change could otherwise go on being charged for a figure
 * the grid no longer shows or lets you edit. Zeroing them here means that charge disappears
 * the moment the project loads, as a visible drop in Total cost, rather than silently.
 * Self-guarding — a no-op once every position has already been cleared.
 */
const HIDDEN_STAFFING_FIELDS = [
  'minimumSalary',
  'maximumSalary',
  'medicalInsurancePct',
  'pensionPct',
  'housingAllowance',
  'transportAllowance',
  'recruitmentCost',
  'trainingCost',
] as const

function zeroHiddenStaffingFields(data: Record<string, unknown>): Record<string, unknown> {
  const staffing = data.staffing
  if (typeof staffing !== 'object' || staffing === null) return data
  const positions = (staffing as Record<string, unknown>).positions
  if (!Array.isArray(positions)) return data

  let changed = false
  const nextPositions = positions.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return entry
    const position = entry as Record<string, unknown>
    const zeroed: Record<string, unknown> = {}
    for (const key of HIDDEN_STAFFING_FIELDS) {
      if (position[key] !== 0) zeroed[key] = 0
    }
    if (Object.keys(zeroed).length === 0) return position
    changed = true
    return { ...position, ...zeroed }
  })

  if (!changed) return data
  return { ...data, staffing: { ...(staffing as Record<string, unknown>), positions: nextPositions } }
}

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
  migrated = normalizeCapacityInputs(migrated)
  migrated = normalizeStaffingPositions(migrated)
  migrated = zeroHiddenStaffingFields(migrated)
  return { ...migrated, schemaVersion: SCHEMA_VERSION }
}

/** Per-version upgrade steps for the cost model, keyed by the schemaVersion they upgrade *from*. */
const MIGRATIONS_COST: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

/**
 * derivedRoleMap tied a position id to the capacity figure that drove its headcount. The
 * staffing grid no longer derives headcount from capacity, so nothing reads this map any
 * more — cleared on load so an old cost model doesn't carry a mapping the app no longer
 * honours. Self-guarding — a no-op once already empty.
 */
function normalizePayrollDerivedRoleMap(data: Record<string, unknown>): Record<string, unknown> {
  const payroll = data.payroll
  if (typeof payroll !== 'object' || payroll === null) return data
  const derivedRoleMap = (payroll as Record<string, unknown>).derivedRoleMap
  if (typeof derivedRoleMap !== 'object' || derivedRoleMap === null) return data
  if (Object.keys(derivedRoleMap as Record<string, unknown>).length === 0) return data
  return { ...data, payroll: { ...(payroll as Record<string, unknown>), derivedRoleMap: {} } }
}

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
  migrated = normalizePayrollDerivedRoleMap(migrated)
  return { ...migrated, schemaVersion: COST_SCHEMA_VERSION }
}

/** Per-version upgrade steps for the capital model, keyed by the schemaVersion they upgrade *from*. */
const MIGRATIONS_CAPITAL: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

/** Upgrades a raw capital model object to the current CAPITAL_SCHEMA_VERSION. */
export function migrateCapitalModel(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data
  let migrated = data as Record<string, unknown>
  let version = typeof migrated.schemaVersion === 'number' ? migrated.schemaVersion : 0
  while (version < CAPITAL_SCHEMA_VERSION) {
    const upgrade = MIGRATIONS_CAPITAL[version]
    migrated = upgrade ? upgrade(migrated) : migrated
    version += 1
  }
  return { ...migrated, schemaVersion: CAPITAL_SCHEMA_VERSION }
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
  capitalModels: Record<string, CapitalModel>
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
  updateInflationPct: (id: string, value: number) => void
  updatePayrollConfig: (id: string, patch: Partial<PayrollConfig>) => void
  updateOpex: (id: string, categories: OpexCategory[]) => void
  updateCapex: (id: string, items: CapexItem[]) => void
  updateFinancing: (id: string, patch: Partial<Financing>) => void
  ensureCapitalModel: (id: string) => void
  updateEquity: (id: string, patch: Partial<Equity>) => void
  updateLoans: (id: string, loans: Loan[]) => void
  updateValuation: (id: string, patch: Partial<Valuation>) => void
  updateOpeningFixedAssets: (id: string, value: number) => void
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

/** Clones a project, its cost model and its capital model under a fresh id, with a given school name. Shared by duplicateProject and createScenario. */
function cloneProjectAndCost(
  source: Project,
  sourceCost: CostModel | undefined,
  sourceCapital: CapitalModel | undefined,
  schoolName: string,
  now: string,
): { project: Project; costModel: CostModel; capitalModel: CapitalModel } {
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
  const capitalModel = CapitalModelSchema.parse({
    ...(sourceCapital ?? createEmptyCapitalModel(source.id, now)),
    projectId: project.id,
    createdAt: now,
    updatedAt: now,
  })
  return { project, costModel, capitalModel }
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

function touchCapital<K extends keyof CapitalModel>(
  capitalModels: Record<string, CapitalModel>,
  id: string,
  key: K,
  value: CapitalModel[K],
): Record<string, CapitalModel> {
  const existing = capitalModels[id]
  if (!existing) return capitalModels
  return {
    ...capitalModels,
    [id]: { ...existing, [key]: value, updatedAt: new Date().toISOString() },
  }
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      projects: {},
      costModels: {},
      capitalModels: {},
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
          capitalModels: {
            ...state.capitalModels,
            [project.id]: createEmptyCapitalModel(project.id, now),
          },
          activeProjectId: project.id,
        }))
        return project.id
      },

      duplicateProject: (id) => {
        const source = get().projects[id]
        if (!source) throw new Error(`Project not found: ${id}`)
        const now = new Date().toISOString()
        const {
          project: clone,
          costModel: cloneCost,
          capitalModel: cloneCapital,
        } = cloneProjectAndCost(
          source,
          get().costModels[id],
          get().capitalModels[id],
          `${source.meta.schoolName} (copy)`,
          now,
        )
        set((state) => ({
          projects: { ...state.projects, [clone.id]: clone },
          costModels: { ...state.costModels, [clone.id]: cloneCost },
          capitalModels: { ...state.capitalModels, [clone.id]: cloneCapital },
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
          const capitalModels = Object.fromEntries(
            Object.entries(state.capitalModels).filter(([projectId]) => projectId !== id),
          )
          const scenarios = Object.fromEntries(
            Object.entries(state.scenarios).filter(([scenarioId]) => scenarioId !== id),
          )
          const activeProjectId =
            state.activeProjectId === id
              ? (Object.keys(projects)[0] ?? null)
              : state.activeProjectId
          return { projects, costModels, capitalModels, scenarios, activeProjectId }
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

      updateInflationPct: (id, value) =>
        set((state) => {
          const cost = state.costModels[id]
          if (!cost) return state
          return { costModels: touchCost(state.costModels, id, 'inflationPct', value) }
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

      ensureCapitalModel: (id) =>
        set((state) => {
          if (!state.projects[id] || state.capitalModels[id]) return state
          return {
            capitalModels: {
              ...state.capitalModels,
              [id]: createEmptyCapitalModel(id, new Date().toISOString()),
            },
          }
        }),

      updateEquity: (id, patch) =>
        set((state) => {
          const capital = state.capitalModels[id]
          if (!capital) return state
          return {
            capitalModels: touchCapital(state.capitalModels, id, 'equity', {
              ...capital.equity,
              ...patch,
            }),
          }
        }),

      updateLoans: (id, loans) =>
        set((state) => {
          const capital = state.capitalModels[id]
          if (!capital) return state
          return { capitalModels: touchCapital(state.capitalModels, id, 'loans', loans) }
        }),

      updateValuation: (id, patch) =>
        set((state) => {
          const capital = state.capitalModels[id]
          if (!capital) return state
          return {
            capitalModels: touchCapital(state.capitalModels, id, 'valuation', {
              ...capital.valuation,
              ...patch,
            }),
          }
        }),

      updateOpeningFixedAssets: (id, value) =>
        set((state) => {
          const capital = state.capitalModels[id]
          if (!capital) return state
          return { capitalModels: touchCapital(state.capitalModels, id, 'openingFixedAssets', value) }
        }),

      createScenario: (baseProjectId, name) => {
        const source = get().projects[baseProjectId]
        if (!source) throw new Error(`Project not found: ${baseProjectId}`)
        const now = new Date().toISOString()
        const {
          project: scenarioProject,
          costModel: scenarioCost,
          capitalModel: scenarioCapital,
        } = cloneProjectAndCost(
          source,
          get().costModels[baseProjectId],
          get().capitalModels[baseProjectId],
          name,
          now,
        )
        set((state) => ({
          projects: { ...state.projects, [scenarioProject.id]: scenarioProject },
          costModels: { ...state.costModels, [scenarioProject.id]: scenarioCost },
          capitalModels: { ...state.capitalModels, [scenarioProject.id]: scenarioCapital },
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

          const positions = project.staffing.positions.map((position) => ({
            ...position,
            headcount: Math.max(0, Math.round((position.headcount * headcountScalePct) / 100)),
          }))

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
        const capitalModel = get().capitalModels[id] ?? createEmptyCapitalModel(id, project.updatedAt)
        return JSON.stringify({ project, costModel, capitalModel })
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
            ? (parsed as { project: unknown; costModel?: unknown; capitalModel?: unknown })
            : { project: parsed, costModel: undefined, capitalModel: undefined }

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

        let capitalModel: CapitalModel
        if (envelope.capitalModel) {
          const capitalResult = CapitalModelSchema.safeParse(migrateCapitalModel(envelope.capitalModel))
          if (!capitalResult.success) {
            return { ok: false, error: capitalResult.error.message }
          }
          capitalModel = { ...capitalResult.data, projectId: project.id, createdAt: now, updatedAt: now }
        } else {
          capitalModel = createEmptyCapitalModel(project.id, now)
        }

        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          costModels: { ...state.costModels, [project.id]: costModel },
          capitalModels: { ...state.capitalModels, [project.id]: capitalModel },
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
        capitalModels: state.capitalModels,
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
        const capitalModels = Object.fromEntries(
          Object.entries(persisted.capitalModels ?? {}).map(([id, capitalModel]) => [
            id,
            CapitalModelSchema.parse(migrateCapitalModel(capitalModel)),
          ]),
        )
        return {
          ...currentState,
          projects,
          costModels,
          capitalModels,
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

const capitalForecastCache = new WeakMap<Project, WeakMap<CostModel, WeakMap<CapitalModel, CapitalForecast>>>()

/** Memoises computeCapitalForecast against the identity of the project, cost model and capital model. */
export function selectCapitalForecast(
  project: Project,
  cost: CostModel,
  capital: CapitalModel,
): CapitalForecast {
  let byCost = capitalForecastCache.get(project)
  if (!byCost) {
    byCost = new WeakMap()
    capitalForecastCache.set(project, byCost)
  }
  let byCapital = byCost.get(cost)
  if (!byCapital) {
    byCapital = new WeakMap()
    byCost.set(cost, byCapital)
  }
  const cached = byCapital.get(capital)
  if (cached) return cached
  const forecast = computeCapitalForecast(project, cost, capital, selectCostForecast(project, cost))
  byCapital.set(capital, forecast)
  return forecast
}

export function useCapitalModel(id: string): CapitalModel | null {
  return useProjectStore((state) => state.capitalModels[id] ?? null)
}

export function useProjectCapitalForecast(id: string): CapitalForecast | null {
  const project = useProjectStore((state) => state.projects[id])
  const cost = useProjectStore((state) => state.costModels[id])
  const capital = useProjectStore((state) => state.capitalModels[id])
  return project && cost && capital ? selectCapitalForecast(project, cost, capital) : null
}
