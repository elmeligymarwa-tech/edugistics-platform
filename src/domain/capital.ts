import { z } from 'zod'

/**
 * Version 3 capital model. Stored alongside a Project and CostModel, keyed by
 * the same project id. The V1 and V2 files stay locked.
 */

const pct = z.number().min(0).max(100)
const money = z.number().min(0)

/* ---------------------------------------------------------------- equity */

export const EquityInjectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: money,
  yearIndex: z.number().int().min(0),
})
export type EquityInjection = z.infer<typeof EquityInjectionSchema>

export const EquitySchema = z.object({
  /** Share capital in place before year one, matching the opening cash. */
  openingShareCapital: money.default(0),
  injections: z.array(EquityInjectionSchema).default([]),
  /** Share of net profit paid out once retained earnings turn positive. */
  dividendPayoutPct: pct.default(0),
})
export type Equity = z.infer<typeof EquitySchema>

/* ----------------------------------------------------------------- loans */

export const RepaymentTypeSchema = z.enum(['annuity', 'straightLine', 'bullet'])
export type RepaymentType = z.infer<typeof RepaymentTypeSchema>

export const LoanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  principal: money.default(0),
  drawYearIndex: z.number().int().min(0).default(0),
  interestRatePct: z.number().min(0).max(100).default(0),
  termYears: z.number().int().min(1).default(5),
  /** Years of interest only before principal repayment starts. */
  graceYears: z.number().int().min(0).default(0),
  repaymentType: RepaymentTypeSchema.default('annuity'),
  arrangementFeePct: pct.default(0),
})
export type Loan = z.infer<typeof LoanSchema>

/* ------------------------------------------------------------- valuation */

export const ValuationMethodSchema = z.enum(['perpetuity', 'exitMultiple'])

export const ValuationSchema = z.object({
  discountRatePct: z.number().min(0).max(100).default(15),
  terminalGrowthPct: z.number().min(-10).max(20).default(3),
  method: ValuationMethodSchema.default('perpetuity'),
  exitEbitdaMultiple: z.number().min(0).max(50).default(8),
})
export type Valuation = z.infer<typeof ValuationSchema>

/* --------------------------------------------------------- capital model */

export const CAPITAL_SCHEMA_VERSION = 1

export const CapitalModelSchema = z.object({
  projectId: z.string().min(1),
  schemaVersion: z.number().int().default(CAPITAL_SCHEMA_VERSION),
  equity: EquitySchema,
  loans: z.array(LoanSchema).default([]),
  valuation: ValuationSchema,
  /** Fixed assets already on the books before year one. */
  openingFixedAssets: money.default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CapitalModel = z.infer<typeof CapitalModelSchema>

export function createEmptyCapitalModel(projectId: string, now: string): CapitalModel {
  return CapitalModelSchema.parse({
    projectId,
    schemaVersion: CAPITAL_SCHEMA_VERSION,
    equity: {},
    loans: [],
    valuation: {},
    openingFixedAssets: 0,
    createdAt: now,
    updatedAt: now,
  })
}
