import { z } from 'zod'

/**
 * Single source of truth for the Edugistics platform domain model.
 * TypeScript types are inferred from these schemas, never declared separately.
 */

export const YEAR_GROUP_ORDER = [
  'FS1',
  'FS2',
  'Y1',
  'Y2',
  'Y3',
  'Y4',
  'Y5',
  'Y6',
  'Y7',
  'Y8',
  'IGCSE_Y9',
  'IGCSE_Y10',
  'IGCSE_Y11',
  'IGCSE_Y12',
] as const

export const YearGroupIdSchema = z.enum(YEAR_GROUP_ORDER)
export type YearGroupId = z.infer<typeof YearGroupIdSchema>

const pct = z.number().min(0).max(100)
const money = z.number().min(0)

/* ------------------------------------------------------------------ meta */

export const ProjectMetaSchema = z.object({
  schoolName: z.string().min(1, 'Enter the school name'),
  logoBase64: z.string().nullable().default(null),
  country: z.string().min(1),
  currencyCode: z.string().length(3),
  currencySymbol: z.string().min(1),
  decimalPlaces: z.number().int().min(0).max(4).default(0),
  locale: z.string().min(2).default('en-GB'),
  /** Reporting rate for the USD view, in local currency per US dollar. */
  usdRate: z.number().min(0.0001).default(50),
  /**
   * An explicit rate for each forecast year, entered directly rather than
   * derived from a devaluation percentage. Empty falls back to usdRate held
   * flat. A shorter array holds its final value.
   */
  usdRateByYear: z.array(z.number().min(0.0001)).default([]),
  /** Regulatory ceiling on annual fee increases. */
  feeEscalationCapPct: z.number().min(0).max(100).default(10),
})
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>

export const CalendarConfigSchema = z.object({
  academicYearStart: z.number().int().min(2020).max(2100),
  financialYearStartMonth: z.number().int().min(1).max(12),
  forecastYears: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10)]),
  termsPerYear: z.number().int().min(1).max(4).default(3),
})
export type CalendarConfig = z.infer<typeof CalendarConfigSchema>

/* -------------------------------------------------------------- capacity */

export const YearGroupCapacitySchema = z.object({
  classrooms: z.number().int().min(0),
  studentsPerClassroom: z.number().int().min(0),
  teachers: z.number().min(0),
  teachingAssistants: z.number().min(0),
  coTeachers: z.number().min(0),
  maxCapacityPct: pct.default(100),
  /**
   * Hard cap in students for this year group. When set, it replaces the
   * classrooms times students per classroom times maximum capacity calculation.
   */
  maxStudents: z.number().min(0).nullable().default(null),
  /**
   * Forecast year this year group opens. Groups selected at setup open in
   * year one. Groups added for later phases open when their year arrives.
   */
  openFromYearIndex: z.number().int().min(0).default(0),
  /**
   * Per year group ramp. Ignored when a school wide ramp or a school plan
   * is set in revenue assumptions.
   */
  occupancyPctByYear: z.array(pct).min(1),
})
export type YearGroupCapacity = z.infer<typeof YearGroupCapacitySchema>

/* ------------------------------------------------------------------ fees */

export const TaxTreatmentSchema = z.enum(['exclusive', 'inclusive', 'exempt'])
export const ChargeBasisSchema = z.enum(['perStudent', 'perFamily', 'oneOffOnEntry'])
export const BillingFrequencySchema = z.enum(['annual', 'termly', 'monthly'])
export const EscalationGroupSchema = z.enum(['tuition', 'other'])

export const FeeCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mandatory: z.boolean().default(true),
  /** Applied to optional categories only. Mandatory categories always use 100. */
  uptakePct: pct.default(100),
  includedInStm: z.boolean().default(false),
  /** Whether sibling, scholarship and staff discounts reduce this category. */
  discountable: z.boolean().default(false),
  taxTreatment: TaxTreatmentSchema.default('exempt'),
  billingFrequency: BillingFrequencySchema.default('annual'),
  chargeBasis: ChargeBasisSchema.default('perStudent'),
  escalationGroup: EscalationGroupSchema.default('other'),
})
export type FeeCategory = z.infer<typeof FeeCategorySchema>

export const FeeStructureSchema = z.object({
  categories: z.array(FeeCategorySchema),
  /** amounts[yearGroupId][categoryId] in base year currency. */
  amounts: z.record(z.string(), z.record(z.string(), money)),
})
export type FeeStructure = z.infer<typeof FeeStructureSchema>

/* ---------------------------------------------------- revenue assumptions */

export const EnrolmentModelSchema = z.enum(['occupancy', 'cohort'])
export type EnrolmentModel = z.infer<typeof EnrolmentModelSchema>

const escalation = z.union([z.number(), z.array(z.number())])

export const DiscountsSchema = z.object({
  siblingPct: pct.default(0),
  siblingEligiblePct: pct.default(0),
  staffChildPct: pct.default(0),
  staffChildPlaces: z.number().int().min(0).default(0),
  scholarshipPct: pct.default(0),
  scholarshipPlaces: z.number().int().min(0).default(0),
  earlyPaymentPct: pct.default(0),
  earlyPaymentTakeUpPct: pct.default(0),
})
export type Discounts = z.infer<typeof DiscountsSchema>

export const CollectionsSchema = z
  .object({
    /** One share per term, summing to 100. */
    termSplit: z.array(pct).min(1),
    payInFullPct: pct.default(0),
    badDebtPct: pct.default(0),
    dsoDays: z.number().min(0).max(365).default(0),
  })
  .refine(
    (c) => Math.abs(c.termSplit.reduce((a, b) => a + b, 0) - 100) < 0.01,
    { message: 'Term split must total 100', path: ['termSplit'] },
  )
export type Collections = z.infer<typeof CollectionsSchema>

/**
 * Top down planning. Enter the school total per year and let the model
 * distribute students across year groups, weighted to the early years.
 */
export const SchoolPlanSchema = z.object({
  enabled: z.boolean().default(false),
  /** Hard ceiling on the whole school, whatever the year group capacities allow. */
  maxSchoolStudents: z.number().min(0).nullable().default(null),
  /** Total students per forecast year. Shorter arrays hold the final value. */
  totalStudentsByYear: z.array(z.number().min(0)).default([]),
  /**
   * How strongly the intake tapers from the first year group to the last.
   * Zero spreads evenly. One hundred gives the final year group no weight.
   */
  taperPct: pct.default(40),
})
export type SchoolPlan = z.infer<typeof SchoolPlanSchema>

export const RevenueAssumptionsSchema = z.object({
  schoolPlan: SchoolPlanSchema.default({
    enabled: false,
    maxSchoolStudents: null,
    totalStudentsByYear: [],
    taperPct: 40,
  }),
  enrolmentModel: EnrolmentModelSchema.default('occupancy'),
  /**
   * One occupancy ramp for the whole school, entered once. When present it
   * overrides every per year group ramp. Empty means fall back to per group.
   */
  schoolOccupancyPctByYear: z.array(pct).default([]),
  tuitionEscalationPct: escalation.default(0),
  otherFeeEscalationPct: escalation.default(0),
  /** newIntake[yearGroupId][forecastYearIndex] */
  newIntake: z.record(z.string(), z.array(z.number().min(0))).default({}),
  /** retentionPct[yearGroupId], applied when a cohort progresses. */
  retentionPct: z.record(z.string(), pct).default({}),
  progression: z.boolean().default(true),
  avgSiblingsPerFamily: z.number().min(1).default(1),
  discounts: DiscountsSchema,
  collections: CollectionsSchema,
  taxRatePct: pct.default(0),
})
export type RevenueAssumptions = z.infer<typeof RevenueAssumptionsSchema>

/* -------------------------------------------------------------- staffing */

export const StaffSectionSchema = z.enum([
  'leadership',
  'teaching',
  'studentServices',
  'administration',
  'facilities',
])

export const StaffPositionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  section: StaffSectionSchema,
  /** True for Teachers, Assistant Teachers and Co-Teachers. Count comes from capacity. */
  derivedFromCapacity: z.boolean().default(false),
  manualOverride: z.boolean().default(false),
  headcount: z.number().min(0).default(0),
  averageSalary: money.default(0),
  minimumSalary: money.default(0),
  maximumSalary: money.default(0),
  annualIncrementPct: pct.default(0),
  employerTaxPct: pct.default(0),
  nationalInsurancePct: pct.default(0),
  medicalInsurancePct: pct.default(0),
  pensionPct: pct.default(0),
  housingAllowance: money.default(0),
  transportAllowance: money.default(0),
  recruitmentCost: money.default(0),
  trainingCost: money.default(0),
  /** Contract length. A ten month teaching contract costs less than twelve. */
  monthsWorked: z.number().min(1).max(12).default(12),
})
export type StaffPosition = z.infer<typeof StaffPositionSchema>

export const StaffingConfigSchema = z.object({
  positions: z.array(StaffPositionSchema).default([]),
})
export type StaffingConfig = z.infer<typeof StaffingConfigSchema>

/* ------------------------------------------------------------------- stm */

export const StmBasisSchema = z.enum(['grossRevenue', 'netRevenue', 'collectedCash'])

export const StmTierSchema = z.object({
  /** Lower bound of the band, in currency. The first tier starts at 0. */
  thresholdFrom: money,
  ratePct: pct,
})

export const StmAgreementSchema = z.object({
  counterpartyName: z.string().min(1),
  basis: StmBasisSchema.default('netRevenue'),
  ratePct: pct.default(0),
  /** Marginal bands. When present, ratePct is ignored. */
  tiers: z.array(StmTierSchema).default([]),
  minimumGuarantee: money.nullable().default(null),
  paymentFrequency: z.enum(['monthly', 'termly', 'annual']).default('annual'),
  startYearIndex: z.number().int().min(0).default(0),
  endYearIndex: z.number().int().min(0).nullable().default(null),
})
export type StmAgreement = z.infer<typeof StmAgreementSchema>

/* --------------------------------------------------------------- project */

export const SCHEMA_VERSION = 1

export const ProjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().default(SCHEMA_VERSION),
  meta: ProjectMetaSchema,
  calendar: CalendarConfigSchema,
  yearGroups: z.array(YearGroupIdSchema),
  capacity: z.record(z.string(), YearGroupCapacitySchema),
  fees: FeeStructureSchema,
  revenueAssumptions: RevenueAssumptionsSchema,
  staffing: StaffingConfigSchema,
  stm: StmAgreementSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Project = z.infer<typeof ProjectSchema>

/** Year groups sorted into teaching ladder order, ignoring selection order. */
export function orderedYearGroups(project: Project): YearGroupId[] {
  return YEAR_GROUP_ORDER.filter((g) => project.yearGroups.includes(g))
}
