import type { FeeCategory, StaffPosition } from '@/domain/schema'
import type { OpexCategory } from '@/domain/costs'
import type { Preset } from './preset-schema'

/** Employer social insurance rate applied to every position in this preset. */
export const EGYPT_SOCIAL_INSURANCE_PCT = 8.6

function feeCategory(overrides: Partial<FeeCategory> & Pick<FeeCategory, 'id' | 'name'>): FeeCategory {
  return {
    mandatory: true,
    uptakePct: 100,
    includedInStm: false,
    discountable: false,
    taxTreatment: 'exempt',
    billingFrequency: 'annual',
    chargeBasis: 'perStudent',
    escalationGroup: 'other',
    ...overrides,
  }
}

function position(overrides: Partial<StaffPosition> & Pick<StaffPosition, 'id' | 'title' | 'section'>): StaffPosition {
  return {
    derivedFromCapacity: false,
    manualOverride: false,
    headcount: 1,
    averageSalary: 0,
    minimumSalary: 0,
    maximumSalary: 0,
    annualIncrementPct: 5,
    employerTaxPct: EGYPT_SOCIAL_INSURANCE_PCT,
    nationalInsurancePct: 0,
    medicalInsurancePct: 0,
    pensionPct: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    recruitmentCost: 0,
    trainingCost: 0,
    ...overrides,
  }
}

const EGYPT_FEE_CATEGORIES: FeeCategory[] = [
  feeCategory({
    id: 'preset-egypt-tuition',
    name: 'Tuition',
    billingFrequency: 'termly',
    escalationGroup: 'tuition',
  }),
  feeCategory({ id: 'preset-egypt-registration', name: 'Registration', chargeBasis: 'oneOffOnEntry' }),
  feeCategory({ id: 'preset-egypt-books', name: 'Books' }),
  feeCategory({ id: 'preset-egypt-uniform', name: 'Uniform' }),
  feeCategory({ id: 'preset-egypt-transport', name: 'Transport', mandatory: false, uptakePct: 40, discountable: true }),
  feeCategory({ id: 'preset-egypt-activities', name: 'Activities' }),
]

const EGYPT_OPEX_CATEGORIES: OpexCategory[] = [
  { id: 'preset-egypt-rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 3_500_000, escalationPct: 5, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-utilities', name: 'Utilities', group: 'facilities', basis: 'perStudent', amount: 1_200, escalationPct: 8, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-maintenance', name: 'Maintenance', group: 'facilities', basis: 'fixed', amount: 600_000, escalationPct: 5, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-cleaning', name: 'Cleaning', group: 'facilities', basis: 'perStudent', amount: 800, escalationPct: 5, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-security', name: 'Security', group: 'facilities', basis: 'fixed', amount: 450_000, escalationPct: 5, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-insurance', name: 'Insurance', group: 'administration', basis: 'fixed', amount: 250_000, escalationPct: 5, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-books-supplies', name: 'Academic supplies', group: 'academic', basis: 'perStudent', amount: 1_500, escalationPct: 5, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-software', name: 'Software and IT', group: 'technology', basis: 'perStudent', amount: 900, escalationPct: 5, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-marketing', name: 'Marketing', group: 'marketing', basis: 'pctOfRevenue', amount: 2, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-transport-opex', name: 'Transport operations', group: 'transport', basis: 'perStudent', amount: 2_500, escalationPct: 6, startYearIndex: 0, endYearIndex: null },
  { id: 'preset-egypt-catering', name: 'Catering', group: 'catering', basis: 'perStudent', amount: 1_800, escalationPct: 6, startYearIndex: 0, endYearIndex: null },
]

const EGYPT_POSITIONS: StaffPosition[] = [
  position({ id: 'preset-egypt-principal', title: 'Principal', section: 'leadership', averageSalary: 1_800_000, minimumSalary: 1_600_000, maximumSalary: 2_200_000 }),
  position({ id: 'preset-egypt-deputy', title: 'Deputy Head', section: 'leadership', averageSalary: 1_100_000, minimumSalary: 900_000, maximumSalary: 1_400_000 }),
  position({ id: 'preset-egypt-head-of-stage', title: 'Head of Stage', section: 'leadership', headcount: 2, averageSalary: 650_000, minimumSalary: 550_000, maximumSalary: 800_000 }),
  position({ id: 'preset-egypt-counsellor', title: 'School Counsellor', section: 'studentServices', averageSalary: 220_000, minimumSalary: 180_000, maximumSalary: 280_000 }),
  position({ id: 'preset-egypt-nurse', title: 'School Nurse', section: 'studentServices', averageSalary: 180_000, minimumSalary: 150_000, maximumSalary: 230_000 }),
  position({ id: 'preset-egypt-registrar', title: 'Registrar', section: 'administration', averageSalary: 200_000, minimumSalary: 160_000, maximumSalary: 260_000 }),
  position({ id: 'preset-egypt-admin-assistant', title: 'Admin Assistant', section: 'administration', headcount: 3, averageSalary: 130_000, minimumSalary: 100_000, maximumSalary: 170_000 }),
  position({ id: 'preset-egypt-facilities-manager', title: 'Facilities Manager', section: 'facilities', averageSalary: 220_000, minimumSalary: 180_000, maximumSalary: 280_000 }),
  position({ id: 'preset-egypt-security-guard', title: 'Security', section: 'facilities', headcount: 4, averageSalary: 90_000, minimumSalary: 75_000, maximumSalary: 110_000 }),
]

/**
 * British curriculum Egypt preset: fee ladder (via the mid-market EGP band),
 * a typical non-teaching staffing establishment (teaching roles are already
 * derived from capacity), 8.6% employer social insurance, salary escalation,
 * VAT-exempt fee treatment and typical operating cost categories. Applied as
 * a starting point — every value stays editable afterwards.
 */
export const BRITISH_CURRICULUM_EGYPT_PRESET: Preset = {
  id: 'british-curriculum-egypt',
  name: 'British curriculum — Egypt',
  description: 'Mid-market EGP fee ladder, typical staffing establishment, 8.6% social insurance and starter operating costs.',
  builtIn: true,
  patch: {
    fees: {
      categories: EGYPT_FEE_CATEGORIES,
      feePositioning: 'midMarket',
    },
    staffing: {
      positions: EGYPT_POSITIONS,
    },
    opex: EGYPT_OPEX_CATEGORIES,
    revenueAssumptions: {
      tuitionEscalationPct: 7,
      otherFeeEscalationPct: 5,
    },
  },
}
