import { z } from 'zod'

import {
  CalendarConfigSchema,
  FeeCategorySchema,
  ProjectMetaSchema,
  SchoolPlanSchema,
  StaffPositionSchema,
  YearGroupIdSchema,
} from '@/domain/schema'
import { OpexCategorySchema } from '@/domain/costs'

/**
 * The wrapper envelope only — never a redeclared domain type. Every value
 * inside `patch` is re-validated against the real, locked domain Zod
 * schemas in `validate-proposal.ts` before it is ever shown or applied;
 * this schema only shapes the conversational turn.
 */

export const ConsultantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

export type ConsultantMessage = z.infer<typeof ConsultantMessageSchema>

/** A partial patch reusing exactly the domain shapes it touches — the same envelope the preset system uses, so the proposal panel and preset apply share one mental model. */
export const ConsultantPatchSchema = z.object({
  meta: ProjectMetaSchema.partial().optional(),
  calendar: CalendarConfigSchema.partial().optional(),
  yearGroups: z.array(YearGroupIdSchema).optional(),
  schoolPlan: SchoolPlanSchema.partial().optional(),
  feeCategories: z.array(FeeCategorySchema).optional(),
  /** Positioning to interpolate a ladder from at apply time, written onto the tuition-escalation-group category. */
  feePositioning: z.enum(['budget', 'midMarket', 'premium', 'luxury']).optional(),
  staffPositions: z.array(StaffPositionSchema).optional(),
  opexCategories: z.array(OpexCategorySchema).optional(),
})

export type ConsultantPatch = z.infer<typeof ConsultantPatchSchema>

export const ConsultantFieldReasonSchema = z.object({
  /** Dot path into the patch, e.g. "meta.country" or "schoolPlan.maxSchoolStudents" — used only for grouping/display, not for applying. */
  path: z.string(),
  label: z.string(),
  reason: z.string(),
})

export type ConsultantFieldReason = z.infer<typeof ConsultantFieldReasonSchema>

export const ConsultantAlternativeSchema = z.object({
  label: z.string(),
  tradeoff: z.string(),
  patch: ConsultantPatchSchema,
  fieldReasons: z.array(ConsultantFieldReasonSchema),
})

export type ConsultantAlternative = z.infer<typeof ConsultantAlternativeSchema>

/** What the model must return, as a single fenced JSON block. Extracted and safeParse'd server-side before anything reaches the client as a "proposal". */
export const ConsultantModelResponseSchema = z.object({
  assistantMessage: z.string(),
  language: z.enum(['en', 'ar']),
  interviewComplete: z.boolean(),
  patch: ConsultantPatchSchema.nullable(),
  fieldReasons: z.array(ConsultantFieldReasonSchema),
  /** Present only when stated targets conflict with capacity/budget — two options side by side, never chosen for the user. */
  alternatives: z.array(ConsultantAlternativeSchema).nullable(),
  breakEvenWarning: z.string().nullable(),
})

export type ConsultantModelResponse = z.infer<typeof ConsultantModelResponseSchema>

/** Request body the client sends to /api/consultant. */
export const ConsultantRequestSchema = z.object({
  mode: z.enum(['interview', 'review']),
  conversationHistory: z.array(ConsultantMessageSchema),
  userMessage: z.string(),
  /** A snapshot of the fields already answered/entered on the current project — nothing from other saved projects. */
  projectSnapshot: z.record(z.string(), z.unknown()),
  /** The current project's cost model, if one exists yet — used only for the break-even feasibility check, never sent to the model. */
  costModelSnapshot: z.record(z.string(), z.unknown()).nullable(),
})

export type ConsultantRequest = z.infer<typeof ConsultantRequestSchema>

export interface ConsultantErrorEnvelope {
  error: 'missing_api_key' | 'upstream_error' | 'malformed_response' | 'invalid_request'
  message: string
  /** Only present for malformed_response — which fields in the model's JSON failed validation. */
  fieldErrors?: string[]
}
