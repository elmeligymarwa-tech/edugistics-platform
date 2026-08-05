import { z } from 'zod'

/**
 * Version 2 cost model. Stored alongside a Project, keyed by the same id.
 * The Version 1 schema is locked, so nothing here modifies it.
 */

const pct = z.number().min(0).max(100)
const money = z.number().min(0)
const escalation = z.union([z.number(), z.array(z.number())])

/* --------------------------------------------------------------- payroll */

export const DerivedRoleSchema = z.enum(['teachers', 'teachingAssistants', 'coTeachers'])
export type DerivedRole = z.infer<typeof DerivedRoleSchema>

export const PayrollConfigSchema = z.object({
  /** Fallback escalation when a position has no annual increment of its own. */
  defaultIncrementPct: escalation.default(0),
  /** Maps a StaffPosition id to the capacity figure that drives its headcount. */
  derivedRoleMap: z.record(z.string(), DerivedRoleSchema).default({}),
  /** Recruitment and training are charged on new hires only, not the whole team. */
  chargeRecruitmentOnNewHiresOnly: z.boolean().default(true),
  /** Annual staff turnover, which creates replacement recruitment cost. */
  turnoverPct: pct.default(0),
  /**
   * Explicit headcount per forecast year, keyed by position id. Overrides both
   * the static headcount and the capacity-derived figure where present, so an
   * establishment plan can be entered year by year.
   */
  headcountByYear: z.record(z.string(), z.array(z.number().min(0))).default({}),
})
export type PayrollConfig = z.infer<typeof PayrollConfigSchema>

/* ------------------------------------------------------------------ opex */

export const OpexBasisSchema = z.enum([
  'fixed',
  'perStudent',
  'perStaff',
  'pctOfRevenue',
  'perClassroom',
])
export type OpexBasis = z.infer<typeof OpexBasisSchema>

export const OpexGroupSchema = z.enum([
  'facilities',
  'academic',
  'administration',
  'marketing',
  'technology',
  'transport',
  'catering',
  'other',
])

export const OpexCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  group: OpexGroupSchema.default('other'),
  basis: OpexBasisSchema.default('fixed'),
  /** Currency for fixed and per-unit bases. Percentage points for pctOfRevenue. */
  amount: money.default(0),
  escalationPct: escalation.default(0),
  startYearIndex: z.number().int().min(0).default(0),
  endYearIndex: z.number().int().min(0).nullable().default(null),
})
export type OpexCategory = z.infer<typeof OpexCategorySchema>

/* ----------------------------------------------------------------- capex */

export const CapexItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: money.default(0),
  /** Forecast year the spend occurs in. */
  yearIndex: z.number().int().min(0).default(0),
  usefulLifeYears: z.number().int().min(1).default(5),
  /** Straight line only in Version 2. */
  method: z.literal('straightLine').default('straightLine'),
})
export type CapexItem = z.infer<typeof CapexItemSchema>

/* ------------------------------------------------------------- financing */

export const FinancingSchema = z.object({
  openingCash: z.number().default(0),
  /** Days of credit taken on operating costs. */
  payablesDays: z.number().min(0).max(365).default(0),
  corporateTaxPct: pct.default(0),
  /** Losses carried forward reduce taxable profit in later years. */
  carryLossesForward: z.boolean().default(true),
})
export type Financing = z.infer<typeof FinancingSchema>

/* ------------------------------------------------------------ cost model */

export const COST_SCHEMA_VERSION = 1

export const CostModelSchema = z.object({
  projectId: z.string().min(1),
  schemaVersion: z.number().int().default(COST_SCHEMA_VERSION),
  payroll: PayrollConfigSchema,
  opex: z.array(OpexCategorySchema).default([]),
  capex: z.array(CapexItemSchema).default([]),
  financing: FinancingSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CostModel = z.infer<typeof CostModelSchema>

export function createEmptyCostModel(projectId: string, now: string): CostModel {
  return CostModelSchema.parse({
    projectId,
    schemaVersion: COST_SCHEMA_VERSION,
    payroll: {},
    opex: [],
    capex: [],
    financing: {},
    createdAt: now,
    updatedAt: now,
  })
}
