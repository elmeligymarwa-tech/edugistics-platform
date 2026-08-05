import { z } from 'zod'
import {
  ProjectMetaSchema,
  CalendarConfigSchema,
  YearGroupIdSchema,
  YearGroupCapacitySchema,
  FeeStructureSchema,
  RevenueAssumptionsSchema,
  StaffingConfigSchema,
  orderedYearGroups,
  type Project,
} from '@/domain/schema'

/**
 * Per-step gates for the setup wizard. Every check delegates to the Zod
 * schemas in src/domain/schema.ts — this file only slices the project and
 * formats the resulting issues, it introduces no new validation rules.
 */

export interface StepValidation {
  valid: boolean
  errors: string[]
}

/** Looks up a single field's message from a safeParse result, for inline display. */
export function fieldMessage(
  result: { success: boolean; error?: z.ZodError },
  path: string,
): string | undefined {
  if (result.success || !result.error) return undefined
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message
}

function messagesFrom(error: z.ZodError, prefix?: string): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.')
    const label = [prefix, path].filter(Boolean).join(' ')
    return label ? `${label}: ${issue.message}` : issue.message
  })
}

export function validateStep1(project: Project): StepValidation {
  const meta = ProjectMetaSchema.safeParse(project.meta)
  const calendar = CalendarConfigSchema.safeParse(project.calendar)
  const errors = [
    ...(meta.success ? [] : messagesFrom(meta.error)),
    ...(calendar.success ? [] : messagesFrom(calendar.error)),
  ]
  return { valid: errors.length === 0, errors }
}

const YearGroupSelectionSchema = z.array(YearGroupIdSchema).min(1, 'Select at least one year group')

export function validateStep2(project: Project): StepValidation {
  const result = YearGroupSelectionSchema.safeParse(project.yearGroups)
  return result.success ? { valid: true, errors: [] } : { valid: false, errors: messagesFrom(result.error) }
}

export function validateStep3(project: Project): StepValidation {
  const errors: string[] = []
  for (const group of orderedYearGroups(project)) {
    const result = YearGroupCapacitySchema.safeParse(project.capacity[group])
    if (!result.success) errors.push(...messagesFrom(result.error, group))
  }
  const schoolRamp = RevenueAssumptionsSchema.shape.schoolOccupancyPctByYear.safeParse(
    project.revenueAssumptions.schoolOccupancyPctByYear,
  )
  if (!schoolRamp.success) errors.push(...messagesFrom(schoolRamp.error, 'School occupancy ramp'))
  return { valid: errors.length === 0, errors }
}

export function validateStep4(project: Project): StepValidation {
  const result = FeeStructureSchema.safeParse(project.fees)
  return result.success ? { valid: true, errors: [] } : { valid: false, errors: messagesFrom(result.error) }
}

export function validateStep5(project: Project): StepValidation {
  const result = RevenueAssumptionsSchema.safeParse(project.revenueAssumptions)
  return result.success ? { valid: true, errors: [] } : { valid: false, errors: messagesFrom(result.error) }
}

export function validateStep6(project: Project): StepValidation {
  const result = StaffingConfigSchema.safeParse(project.staffing)
  return result.success ? { valid: true, errors: [] } : { valid: false, errors: messagesFrom(result.error) }
}

export const WIZARD_STEP_COUNT = 6

export function validateStep(step: number, project: Project): StepValidation {
  switch (step) {
    case 1:
      return validateStep1(project)
    case 2:
      return validateStep2(project)
    case 3:
      return validateStep3(project)
    case 4:
      return validateStep4(project)
    case 5:
      return validateStep5(project)
    case 6:
      return validateStep6(project)
    default:
      return { valid: true, errors: [] }
  }
}
