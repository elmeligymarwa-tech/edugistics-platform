import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get as idbGet } from 'idb-keyval'
import { ProjectSchema, SCHEMA_VERSION } from '../domain/schema'
import {
  useProjectStore,
  createEmptyProject,
  migrateProject,
  STORAGE_NAME,
} from './project-store'

beforeEach(() => {
  useProjectStore.setState({ projects: {}, activeProjectId: null })
})

describe('createEmptyProject', () => {
  it('produces a project that satisfies ProjectSchema', () => {
    const project = createEmptyProject({ schoolName: 'Riverside School' })
    expect(() => ProjectSchema.parse(project)).not.toThrow()
    expect(project.schemaVersion).toBe(SCHEMA_VERSION)
    expect(project.meta.schoolName).toBe('Riverside School')
  })
})

describe('createProject', () => {
  it('adds a schema-valid project and makes it active', () => {
    const id = useProjectStore.getState().createProject('Riverside School')
    const state = useProjectStore.getState()
    expect(state.activeProjectId).toBe(id)
    expect(state.projects[id]?.meta.schoolName).toBe('Riverside School')
    expect(() => ProjectSchema.parse(state.projects[id])).not.toThrow()
  })
})

describe('duplicateProject', () => {
  it('clones a project under a new id with an updated label', () => {
    const sourceId = useProjectStore.getState().createProject('Original School')
    const cloneId = useProjectStore.getState().duplicateProject(sourceId)
    const state = useProjectStore.getState()
    expect(cloneId).not.toBe(sourceId)
    expect(state.projects[cloneId]?.meta.schoolName).toBe('Original School (copy)')
    expect(state.activeProjectId).toBe(cloneId)
  })
})

describe('renameProject', () => {
  it('updates the school name and leaves other fields intact', () => {
    const id = useProjectStore.getState().createProject('Old Name')
    useProjectStore.getState().renameProject(id, 'New Name')
    expect(useProjectStore.getState().projects[id]?.meta.schoolName).toBe('New Name')
  })
})

describe('deleteProject', () => {
  it('removes the project and reassigns the active id', () => {
    const first = useProjectStore.getState().createProject('First School')
    const second = useProjectStore.getState().createProject('Second School')
    useProjectStore.getState().deleteProject(second)
    const state = useProjectStore.getState()
    expect(state.projects[second]).toBeUndefined()
    expect(state.activeProjectId).toBe(first)
  })
})

describe('granular updates', () => {
  it('applies wizard-step patches and bumps updatedAt', async () => {
    const id = useProjectStore.getState().createProject('Wizard School')
    const before = useProjectStore.getState().projects[id]!.updatedAt

    await new Promise((resolve) => setTimeout(resolve, 5))

    useProjectStore.getState().updateMeta(id, { country: 'Egypt', currencyCode: 'EGP', currencySymbol: 'E£' })
    useProjectStore.getState().updateCalendar(id, { forecastYears: 10 })
    useProjectStore.getState().updateYearGroups(id, ['Y1', 'Y2'])
    useProjectStore.getState().updateCapacity(id, 'Y1', {
      classrooms: 2,
      studentsPerClassroom: 20,
      occupancyPctByYear: [100],
    })

    const project = useProjectStore.getState().projects[id]!
    expect(project.meta.country).toBe('Egypt')
    expect(project.calendar.forecastYears).toBe(10)
    expect(project.yearGroups).toEqual(['Y1', 'Y2'])
    expect(project.capacity.Y1?.classrooms).toBe(2)
    expect(project.updatedAt > before).toBe(true)
    expect(() => ProjectSchema.parse(project)).not.toThrow()
  })
})

describe('exportProject', () => {
  it('serialises a project as schema-valid JSON', () => {
    const id = useProjectStore.getState().createProject('Export School')
    const json = useProjectStore.getState().exportProject(id)
    const parsed: unknown = JSON.parse(json)
    expect(() => ProjectSchema.parse(parsed)).not.toThrow()
  })
})

describe('importProject', () => {
  it('imports a valid exported project under a fresh id', () => {
    const sourceId = useProjectStore.getState().createProject('Import School')
    const json = useProjectStore.getState().exportProject(sourceId)

    const result = useProjectStore.getState().importProject(json)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).not.toBe(sourceId)
    expect(useProjectStore.getState().projects[result.id]?.meta.schoolName).toBe('Import School')
    expect(useProjectStore.getState().activeProjectId).toBe(result.id)
  })

  it('rejects a project that fails ProjectSchema without mutating the store', () => {
    const before = useProjectStore.getState().projects
    const invalid = JSON.stringify({ id: 'incomplete', meta: {} })

    const result = useProjectStore.getState().importProject(invalid)

    expect(result.ok).toBe(false)
    expect(useProjectStore.getState().projects).toBe(before)
  })

  it('rejects malformed JSON text', () => {
    const result = useProjectStore.getState().importProject('{not valid json')
    expect(result.ok).toBe(false)
  })
})

describe('migrateProject', () => {
  it('upgrades a legacy project to the current schemaVersion', () => {
    const id = useProjectStore.getState().createProject('Legacy School')
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as Record<
      string,
      unknown
    >
    delete exported.schemaVersion

    const migrated = migrateProject(exported) as Record<string, unknown>

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(() => ProjectSchema.parse(migrated)).not.toThrow()
  })

  it('passes non-object input through unchanged', () => {
    expect(migrateProject(null)).toBeNull()
    expect(migrateProject('not-a-project')).toBe('not-a-project')
  })
})

describe('rehydration', () => {
  it('exposes hasHydrated and flips to true once IndexedDB has been read', async () => {
    vi.resetModules()
    const mod = await import('./project-store')

    expect(mod.useProjectStore.getState().hasHydrated).toBe(false)
    await vi.waitFor(() => {
      expect(mod.useProjectStore.getState().hasHydrated).toBe(true)
    })
  })

  it('gating auto-creation on hasHydrated avoids orphaning a persisted project behind a fresh empty one', async () => {
    // Simulate a previous session that saved a populated project to IndexedDB.
    vi.resetModules()
    const priorSession = await import('./project-store')
    const id = priorSession.useProjectStore.getState().createProject('Riverside International School')
    priorSession.useProjectStore.getState().updateMeta(id, { country: 'Egypt' })
    await new Promise((resolve) => setTimeout(resolve, 700)) // let the debounced idb write land

    // Simulate a page reload: a fresh store instance reading the same backing store.
    vi.resetModules()
    const reloadedSession = await import('./project-store')

    // Mirrors the wizard's setup page: only decide whether to auto-create once hydration has resolved.
    await vi.waitFor(() => {
      expect(reloadedSession.useProjectStore.getState().hasHydrated).toBe(true)
    })
    const state = reloadedSession.useProjectStore.getState()
    if (!state.activeProjectId) state.createProject('Should never run')

    const finalState = reloadedSession.useProjectStore.getState()
    expect(Object.keys(finalState.projects)).toHaveLength(1)
    const activeProject = finalState.activeProjectId
      ? finalState.projects[finalState.activeProjectId]
      : undefined
    expect(activeProject?.meta.schoolName).toBe('Riverside International School')
  }, 3000)
})

describe('storage persistence', () => {
  it('debounces writes to IndexedDB by 500ms', async () => {
    const id = useProjectStore.getState().createProject('Debounce School')
    useProjectStore.getState().renameProject(id, 'Debounce School Renamed')

    await new Promise((resolve) => setTimeout(resolve, 200))
    const early = await idbGet<string>(STORAGE_NAME)
    const earlyName = early
      ? (JSON.parse(early).state.projects[id]?.meta.schoolName ?? undefined)
      : undefined
    expect(earlyName).not.toBe('Debounce School Renamed')

    await new Promise((resolve) => setTimeout(resolve, 500))
    const settled = await idbGet<string>(STORAGE_NAME)
    expect(settled).toBeDefined()
    expect(JSON.parse(settled as string).state.projects[id]?.meta.schoolName).toBe(
      'Debounce School Renamed',
    )
  }, 3000)
})
