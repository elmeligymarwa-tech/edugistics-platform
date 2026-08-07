import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { ProjectSchema, SCHEMA_VERSION } from '../domain/schema'
import { CostModelSchema, COST_SCHEMA_VERSION } from '../domain/costs'
import {
  useProjectStore,
  createEmptyProject,
  migrateProject,
  migrateCostModel,
  STORAGE_NAME,
} from './project-store'

beforeEach(() => {
  useProjectStore.setState({ projects: {}, costModels: {}, scenarios: {}, activeProjectId: null })
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
  it('serialises a project and its cost model as a schema-valid envelope', () => {
    const id = useProjectStore.getState().createProject('Export School')
    const json = useProjectStore.getState().exportProject(id)
    const parsed = JSON.parse(json) as { project: unknown; costModel: unknown }
    expect(() => ProjectSchema.parse(parsed.project)).not.toThrow()
    expect(() => CostModelSchema.parse(parsed.costModel)).not.toThrow()
  })
})

describe('importProject', () => {
  it('imports a valid exported project and cost model under a fresh id', () => {
    const sourceId = useProjectStore.getState().createProject('Import School')
    useProjectStore.getState().updatePayrollConfig(sourceId, { defaultIncrementPct: 5 })
    const json = useProjectStore.getState().exportProject(sourceId)

    const result = useProjectStore.getState().importProject(json)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).not.toBe(sourceId)
    expect(useProjectStore.getState().projects[result.id]?.meta.schoolName).toBe('Import School')
    expect(useProjectStore.getState().costModels[result.id]?.payroll.defaultIncrementPct).toBe(5)
    expect(useProjectStore.getState().costModels[result.id]?.projectId).toBe(result.id)
    expect(useProjectStore.getState().activeProjectId).toBe(result.id)
  })

  it('imports a legacy bare-Project export by synthesising an empty cost model', () => {
    const legacyProject = createEmptyProject({ schoolName: 'Legacy Export' })
    const result = useProjectStore.getState().importProject(JSON.stringify(legacyProject))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(useProjectStore.getState().costModels[result.id]).toBeDefined()
    expect(useProjectStore.getState().costModels[result.id]?.projectId).toBe(result.id)
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
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      project: Record<string, unknown>
    }
    const legacy = exported.project
    delete legacy.schemaVersion

    const migrated = migrateProject(legacy) as Record<string, unknown>

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(() => ProjectSchema.parse(migrated)).not.toThrow()
  })

  it('passes non-object input through unchanged', () => {
    expect(migrateProject(null)).toBeNull()
    expect(migrateProject('not-a-project')).toBe('not-a-project')
  })

  it('folds maxCapacityPct into max students per class and clears the percentage/override', () => {
    const id = useProjectStore.getState().createProject('Old Capacity School')
    useProjectStore.getState().updateYearGroups(id, ['Y1'])
    useProjectStore.getState().updateCapacity(id, 'Y1', {
      classrooms: 10,
      studentsPerClassroom: 25,
      maxCapacityPct: 90,
      maxStudents: null,
    })
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      project: Record<string, unknown>
    }

    const migrated = migrateProject(exported.project) as {
      capacity: Record<string, { studentsPerClassroom: number; maxStudents: number | null; maxCapacityPct: number }>
    }

    // 10 classrooms * 25 students/classroom * 90% = 225 ceiling, folded back as 22.5 -> 23/classroom.
    expect(migrated.capacity.Y1?.studentsPerClassroom).toBe(23)
    expect(migrated.capacity.Y1?.maxStudents).toBeNull()
    expect(migrated.capacity.Y1?.maxCapacityPct).toBe(100)
  })

  it('folds an explicit maxStudents override into max students per class', () => {
    const id = useProjectStore.getState().createProject('Capped School')
    useProjectStore.getState().updateYearGroups(id, ['Y1'])
    useProjectStore.getState().updateCapacity(id, 'Y1', {
      classrooms: 10,
      studentsPerClassroom: 25,
      maxCapacityPct: 100,
      maxStudents: 30,
    })
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      project: Record<string, unknown>
    }

    const migrated = migrateProject(exported.project) as {
      capacity: Record<string, { studentsPerClassroom: number; maxStudents: number | null; maxCapacityPct: number }>
    }

    expect(migrated.capacity.Y1?.studentsPerClassroom).toBe(3)
    expect(migrated.capacity.Y1?.maxStudents).toBeNull()
    expect(migrated.capacity.Y1?.maxCapacityPct).toBe(100)
  })

  it('leaves a project already expressed as pure classrooms/students-per-class untouched', () => {
    const id = useProjectStore.getState().createProject('Modern School')
    useProjectStore.getState().updateYearGroups(id, ['Y1'])
    useProjectStore.getState().updateCapacity(id, 'Y1', {
      classrooms: 10,
      studentsPerClassroom: 23,
      maxCapacityPct: 100,
      maxStudents: null,
    })
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      project: Record<string, unknown>
    }

    const migrated = migrateProject(exported.project) as {
      capacity: Record<string, { studentsPerClassroom: number }>
    }

    expect(migrated.capacity.Y1?.studentsPerClassroom).toBe(23)
  })

  it('folds a school-wide occupancy ramp into each open year group and clears it', () => {
    const id = useProjectStore.getState().createProject('Ramped School')
    useProjectStore.getState().updateYearGroups(id, ['Y1', 'Y2'])
    useProjectStore.getState().updateCapacity(id, 'Y1', { classrooms: 2, studentsPerClassroom: 20 })
    useProjectStore.getState().updateCapacity(id, 'Y2', { classrooms: 2, studentsPerClassroom: 20 })
    useProjectStore.getState().updateRevenueAssumptions(id, { schoolOccupancyPctByYear: [50, 75, 100] })

    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      project: Record<string, unknown>
    }

    const migrated = migrateProject(exported.project) as {
      capacity: Record<string, { occupancyPctByYear: number[] }>
      revenueAssumptions: { schoolOccupancyPctByYear: number[] }
    }

    expect(migrated.capacity.Y1?.occupancyPctByYear).toEqual([50, 75, 100])
    expect(migrated.capacity.Y2?.occupancyPctByYear).toEqual([50, 75, 100])
    expect(migrated.revenueAssumptions.schoolOccupancyPctByYear).toEqual([])
  })

  it('zeroes the staffing fields dropped from the grid, leaving the rest of the position untouched', () => {
    const id = useProjectStore.getState().createProject('Legacy Payroll School')
    useProjectStore.getState().updateStaffing(id, {
      positions: [
        {
          id: 'pos-1',
          title: 'Teacher',
          section: 'teaching',
          derivedFromCapacity: false,
          manualOverride: false,
          headcount: 2,
          averageSalary: 200000,
          minimumSalary: 160000,
          maximumSalary: 260000,
          annualIncrementPct: 5,
          employerTaxPct: 10,
          nationalInsurancePct: 8,
          medicalInsurancePct: 3,
          pensionPct: 4,
          housingAllowance: 12000,
          transportAllowance: 6000,
          recruitmentCost: 5000,
          trainingCost: 2000,
          monthsWorked: 12,
        },
      ],
    })
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      project: Record<string, unknown>
    }

    const migrated = migrateProject(exported.project) as {
      staffing: { positions: Record<string, unknown>[] }
    }
    const position = migrated.staffing.positions[0]!

    expect(position.minimumSalary).toBe(0)
    expect(position.maximumSalary).toBe(0)
    expect(position.medicalInsurancePct).toBe(0)
    expect(position.pensionPct).toBe(0)
    expect(position.housingAllowance).toBe(0)
    expect(position.transportAllowance).toBe(0)
    expect(position.recruitmentCost).toBe(0)
    expect(position.trainingCost).toBe(0)

    // Fields still shown in the grid are untouched.
    expect(position.averageSalary).toBe(200000)
    expect(position.headcount).toBe(2)
    expect(position.annualIncrementPct).toBe(5)
    expect(position.employerTaxPct).toBe(10)
    expect(position.nationalInsurancePct).toBe(8)
    expect(position.monthsWorked).toBe(12)
  })

  it('leaves a project with already-zeroed hidden staffing fields untouched', () => {
    const id = useProjectStore.getState().createProject('Clean Payroll School')
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      project: Record<string, unknown>
    }
    const before = JSON.stringify(exported.project)

    const migrated = migrateProject(JSON.parse(before)) as Record<string, unknown>

    expect(JSON.stringify(migrated)).toBe(before)
  })
})

describe('cost model', () => {
  it('seeds an empty schema-valid cost model when a project is created', () => {
    const id = useProjectStore.getState().createProject('Costed School')
    const cost = useProjectStore.getState().costModels[id]
    expect(cost).toBeDefined()
    expect(cost?.projectId).toBe(id)
    expect(cost?.schemaVersion).toBe(COST_SCHEMA_VERSION)
    expect(() => CostModelSchema.parse(cost)).not.toThrow()
  })

  it('clones the cost model, re-pointed at the new project id, on duplicateProject', () => {
    const sourceId = useProjectStore.getState().createProject('Original School')
    useProjectStore.getState().updateFinancing(sourceId, { openingCash: 50000 })
    const cloneId = useProjectStore.getState().duplicateProject(sourceId)

    const clonedCost = useProjectStore.getState().costModels[cloneId]
    expect(clonedCost?.projectId).toBe(cloneId)
    expect(clonedCost?.financing.openingCash).toBe(50000)
  })

  it('removes the cost model when its project is deleted', () => {
    const id = useProjectStore.getState().createProject('Doomed School')
    useProjectStore.getState().deleteProject(id)
    expect(useProjectStore.getState().costModels[id]).toBeUndefined()
  })

  it('applies granular updates to payroll, opex, capex and financing', () => {
    const id = useProjectStore.getState().createProject('Granular School')

    useProjectStore.getState().updatePayrollConfig(id, { turnoverPct: 12 })
    useProjectStore.getState().updateOpex(id, [
      {
        id: 'rent',
        name: 'Rent',
        group: 'facilities',
        basis: 'fixed',
        amount: 100000,
        stepSizeStudents: 50,
        escalationPct: 0,
        startYearIndex: 0,
        endYearIndex: null,
      },
    ])
    useProjectStore.getState().updateCapex(id, [
      { id: 'fitout', name: 'Fit out', amount: 200000, yearIndex: 0, usefulLifeYears: 5, method: 'straightLine' },
    ])
    useProjectStore.getState().updateFinancing(id, { corporateTaxPct: 20 })

    const cost = useProjectStore.getState().costModels[id]!
    expect(cost.payroll.turnoverPct).toBe(12)
    expect(cost.opex).toHaveLength(1)
    expect(cost.capex).toHaveLength(1)
    expect(cost.financing.corporateTaxPct).toBe(20)
    expect(() => CostModelSchema.parse(cost)).not.toThrow()
  })

  it('ensureCostModel is idempotent and only creates when missing', () => {
    const id = useProjectStore.getState().createProject('Idempotent School')
    useProjectStore.getState().updateFinancing(id, { openingCash: 999 })

    useProjectStore.getState().ensureCostModel(id)

    expect(useProjectStore.getState().costModels[id]?.financing.openingCash).toBe(999)
  })
})

describe('scenarios', () => {
  it('createScenario duplicates the project and cost model with lineage metadata', () => {
    const baseId = useProjectStore.getState().createProject('Base School')
    useProjectStore.getState().updateFinancing(baseId, { openingCash: 10000 })

    const scenarioId = useProjectStore.getState().createScenario(baseId, 'Recession case')

    const state = useProjectStore.getState()
    expect(scenarioId).not.toBe(baseId)
    expect(state.projects[scenarioId]?.meta.schoolName).toBe('Recession case')
    expect(state.costModels[scenarioId]?.financing.openingCash).toBe(10000)
    expect(state.costModels[scenarioId]?.projectId).toBe(scenarioId)
    expect(state.scenarios[scenarioId]).toEqual({
      baseProjectId: baseId,
      name: 'Recession case',
      createdAt: state.scenarios[scenarioId]?.createdAt,
    })
    expect(state.activeProjectId).toBe(scenarioId)
  })

  it('removes the scenario entry when its project is deleted', () => {
    const baseId = useProjectStore.getState().createProject('Base School')
    const scenarioId = useProjectStore.getState().createScenario(baseId, 'Downside case')

    useProjectStore.getState().deleteProject(scenarioId)

    expect(useProjectStore.getState().scenarios[scenarioId]).toBeUndefined()
  })

  it('applyScenarioAdjustments patches occupancy, escalation, discounts and headcount atomically', () => {
    const baseId = useProjectStore.getState().createProject('Base School')
    useProjectStore.getState().updateYearGroups(baseId, ['Y1'])
    useProjectStore.getState().updateCapacity(baseId, 'Y1', {
      classrooms: 2,
      studentsPerClassroom: 20,
      occupancyPctByYear: [80, 90],
    })
    useProjectStore.getState().updateRevenueAssumptions(baseId, {
      tuitionEscalationPct: 3,
      discounts: {
        staffChildPct: 5,
        staffChildPlaces: 0,
        scholarshipPct: 2,
        scholarshipPlaces: 0,
        earlyPaymentPct: 1,
        earlyPaymentTakeUpPct: 0,
      },
    })
    useProjectStore.getState().updateStaffing(baseId, {
      positions: [
        {
          id: 'admin-1',
          title: 'Admin assistant',
          section: 'administration',
          derivedFromCapacity: false,
          manualOverride: false,
          headcount: 10,
          averageSalary: 0,
          minimumSalary: 0,
          maximumSalary: 0,
          annualIncrementPct: 0,
          employerTaxPct: 0,
          nationalInsurancePct: 0,
          medicalInsurancePct: 0,
          pensionPct: 0,
          housingAllowance: 0,
          transportAllowance: 0,
          recruitmentCost: 0,
          trainingCost: 0,
          monthsWorked: 12,
        },
      ],
    })
    useProjectStore.getState().updatePayrollConfig(baseId, { defaultIncrementPct: 4 })

    const scenarioId = useProjectStore.getState().createScenario(baseId, 'Downside case')
    useProjectStore.getState().applyScenarioAdjustments(scenarioId, {
      occupancyDeltaPct: -10,
      feeEscalationDeltaPct: -1,
      salaryEscalationDeltaPct: 2,
      discountDeltaPct: 5,
      headcountScalePct: 80,
    })

    const project = useProjectStore.getState().projects[scenarioId]!
    const cost = useProjectStore.getState().costModels[scenarioId]!

    expect(project.capacity.Y1?.occupancyPctByYear).toEqual([70, 80])
    expect(project.revenueAssumptions.tuitionEscalationPct).toBe(2)
    expect(project.revenueAssumptions.discounts.staffChildPct).toBe(10)
    expect(project.staffing.positions[0]?.headcount).toBe(8)
    expect(cost.payroll.defaultIncrementPct).toBe(6)

    // The base project is untouched.
    const base = useProjectStore.getState().projects[baseId]!
    expect(base.capacity.Y1?.occupancyPctByYear).toEqual([80, 90])
    expect(base.staffing.positions[0]?.headcount).toBe(10)
  })

  it('applyScenarioAdjustments clamps occupancy and discount percentages to 0-100', () => {
    const baseId = useProjectStore.getState().createProject('Base School')
    useProjectStore.getState().updateYearGroups(baseId, ['Y1'])
    useProjectStore.getState().updateCapacity(baseId, 'Y1', {
      classrooms: 1,
      studentsPerClassroom: 20,
      occupancyPctByYear: [95],
    })
    const scenarioId = useProjectStore.getState().createScenario(baseId, 'Overshoot case')

    useProjectStore.getState().applyScenarioAdjustments(scenarioId, { occupancyDeltaPct: 50 })

    expect(useProjectStore.getState().projects[scenarioId]?.capacity.Y1?.occupancyPctByYear).toEqual([100])
  })

  it('applyScenarioAdjustments scales every position headcount, none of them derived any more', () => {
    const baseId = useProjectStore.getState().createProject('Base School')
    useProjectStore.getState().updateStaffing(baseId, {
      positions: [
        {
          id: 'teacher-1',
          title: 'Teacher',
          section: 'teaching',
          derivedFromCapacity: false,
          manualOverride: false,
          headcount: 5,
          averageSalary: 0,
          minimumSalary: 0,
          maximumSalary: 0,
          annualIncrementPct: 0,
          employerTaxPct: 0,
          nationalInsurancePct: 0,
          medicalInsurancePct: 0,
          pensionPct: 0,
          housingAllowance: 0,
          transportAllowance: 0,
          recruitmentCost: 0,
          trainingCost: 0,
          monthsWorked: 12,
        },
      ],
    })
    const scenarioId = useProjectStore.getState().createScenario(baseId, 'Headcount case')

    useProjectStore.getState().applyScenarioAdjustments(scenarioId, { headcountScalePct: 50 })

    expect(useProjectStore.getState().projects[scenarioId]?.staffing.positions[0]?.headcount).toBe(3)
  })
})

describe('migrateCostModel', () => {
  it('upgrades a legacy cost model to the current COST_SCHEMA_VERSION', () => {
    const id = useProjectStore.getState().createProject('Legacy Cost School')
    const exported = JSON.parse(useProjectStore.getState().exportProject(id)) as {
      costModel: Record<string, unknown>
    }
    const legacy = exported.costModel
    delete legacy.schemaVersion

    const migrated = migrateCostModel(legacy) as Record<string, unknown>

    expect(migrated.schemaVersion).toBe(COST_SCHEMA_VERSION)
    expect(() => CostModelSchema.parse(migrated)).not.toThrow()
  })

  it('passes non-object input through unchanged', () => {
    expect(migrateCostModel(null)).toBeNull()
    expect(migrateCostModel('not-a-cost-model')).toBe('not-a-cost-model')
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

  it('backfills a missing cost model for a legacy persisted project once hydrated, gated the same way', async () => {
    // Write a legacy-format blob directly to the backing store: a project with no `costModels` key at all,
    // as if persisted before the cost model existed.
    vi.resetModules()
    const { createEmptyProject: createLegacyProject, STORAGE_NAME: storageName } =
      await import('./project-store')
    const legacyProject = createLegacyProject({ schoolName: 'Pre-cost-model School' })
    await idbSet(
      storageName,
      JSON.stringify({
        state: { projects: { [legacyProject.id]: legacyProject }, activeProjectId: legacyProject.id },
        version: 0,
      }),
    )

    // Simulate a page reload with the app-wide sync effect's logic: only backfill once hydrated.
    vi.resetModules()
    const reloadedSession = await import('./project-store')
    await vi.waitFor(() => {
      expect(reloadedSession.useProjectStore.getState().hasHydrated).toBe(true)
    })
    expect(reloadedSession.useProjectStore.getState().projects[legacyProject.id]).toBeDefined()
    expect(reloadedSession.useProjectStore.getState().costModels[legacyProject.id]).toBeUndefined()

    reloadedSession.useProjectStore.getState().ensureCostModel(legacyProject.id)

    const cost = reloadedSession.useProjectStore.getState().costModels[legacyProject.id]
    expect(cost).toBeDefined()
    expect(cost?.projectId).toBe(legacyProject.id)
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
