import { describe, expect, it } from 'vitest'

import { createEmptyCostModel } from '@/domain/costs'
import { ProjectSchema, type Project } from '@/domain/schema'
import { createEmptyProject } from '@/store/project-store'
import { checkBreakEven } from './break-even-check'
import type { ConsultantModelResponse } from './route-contract'

function makeProject(overrides: { averageSalary: number }): Project {
  const base = createEmptyProject({ schoolName: 'Test School' })
  return ProjectSchema.parse({
    ...base,
    yearGroups: ['FS1', 'FS2'],
    capacity: {
      FS1: {
        classrooms: 2,
        studentsPerClassroom: 20,
        teachers: 2,
        teachingAssistants: 1,
        coTeachers: 0,
        occupancyPctByYear: [80, 85, 90, 90, 90],
      },
      FS2: {
        classrooms: 2,
        studentsPerClassroom: 20,
        teachers: 2,
        teachingAssistants: 1,
        coTeachers: 0,
        occupancyPctByYear: [80, 85, 90, 90, 90],
      },
    },
    fees: {
      categories: [{ id: 'tuition', name: 'Tuition', escalationGroup: 'tuition' }],
      amounts: { FS1: { tuition: 50_000 }, FS2: { tuition: 50_000 } },
    },
    staffing: {
      positions: [
        {
          id: 'principal',
          title: 'Principal',
          section: 'leadership',
          headcount: 1,
          averageSalary: overrides.averageSalary,
        },
      ],
    },
  })
}

function baseResponse(): ConsultantModelResponse {
  return {
    assistantMessage: 'Here is a proposal.',
    language: 'en',
    interviewComplete: false,
    patch: { feePositioning: 'midMarket' },
    fieldReasons: [{ path: 'feePositioning', label: 'Fee positioning', reason: 'Matches stated market.' }],
    alternatives: null,
    breakEvenWarning: null,
  }
}

describe('checkBreakEven', () => {
  it('leaves the response untouched when there is no feePositioning in the patch', () => {
    const project = makeProject({ averageSalary: 1_000 })
    const costModel = createEmptyCostModel(project.id, project.updatedAt)
    const response: ConsultantModelResponse = { ...baseResponse(), patch: { meta: { country: 'Egypt' } } }
    expect(checkBreakEven(project, costModel, response)).toBe(response)
  })

  it('leaves the response untouched when the model already gave a breakEvenWarning', () => {
    const project = makeProject({ averageSalary: 1_000 })
    const costModel = createEmptyCostModel(project.id, project.updatedAt)
    const response: ConsultantModelResponse = { ...baseResponse(), breakEvenWarning: 'Already flagged.' }
    expect(checkBreakEven(project, costModel, response)).toBe(response)
  })

  it('leaves a healthy candidate forecast unchanged', () => {
    const project = makeProject({ averageSalary: 1_000 })
    const costModel = createEmptyCostModel(project.id, project.updatedAt)
    const response = baseResponse()
    const result = checkBreakEven(project, costModel, response)
    expect(result.breakEvenWarning).toBeNull()
    expect(result.alternatives).toBeNull()
  })

  it('adds a breakEvenWarning and a next-band alternative when the candidate never breaks even', () => {
    const project = makeProject({ averageSalary: 100_000_000 })
    const costModel = createEmptyCostModel(project.id, project.updatedAt)
    const response = baseResponse()
    const result = checkBreakEven(project, costModel, response)

    expect(result.breakEvenWarning).toBeTruthy()
    expect(result.alternatives).toHaveLength(1)
    expect(result.alternatives?.[0]?.patch.feePositioning).toBe('premium')
  })

  it('warns without an alternative when already at the top fee band', () => {
    const project = makeProject({ averageSalary: 100_000_000 })
    const costModel = createEmptyCostModel(project.id, project.updatedAt)
    const response: ConsultantModelResponse = { ...baseResponse(), patch: { feePositioning: 'luxury' } }
    const result = checkBreakEven(project, costModel, response)

    expect(result.breakEvenWarning).toBeTruthy()
    expect(result.alternatives).toBeNull()
  })
})
