import type { OpexBasis, OpexCategory } from '@/domain/costs'

type OpexGroup = OpexCategory['group']

/**
 * Reference data for the Operational Expenses module. Not domain state —
 * purely UI lookup tables and a starter template, applied by explicit user
 * action rather than injected automatically.
 */

export const OPEX_GROUP_LABELS: Record<OpexGroup, string> = {
  facilities: 'Facilities',
  academic: 'Academic',
  administration: 'Administration',
  marketing: 'Marketing',
  technology: 'Technology',
  transport: 'Transport',
  catering: 'Catering',
  other: 'Other',
}

export const OPEX_BASIS_LABELS: Record<OpexBasis, string> = {
  fixed: 'Fixed',
  perStudent: 'Per student',
  perStaff: 'Per staff',
  perClassroom: 'Per classroom',
  pctOfRevenue: '% of net revenue',
  stepped: 'Stepped',
}

/** A common set of school operating cost categories, offered as a one-click starting point. */
export const STARTER_OPEX_CATEGORIES: OpexCategory[] = [
  { id: 'rent', name: 'Rent', group: 'facilities', basis: 'fixed', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'utilities', name: 'Utilities', group: 'facilities', basis: 'perStudent', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'maintenance', name: 'Maintenance', group: 'facilities', basis: 'fixed', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'cleaning', name: 'Cleaning', group: 'facilities', basis: 'fixed', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'security', name: 'Security', group: 'facilities', basis: 'fixed', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'insurance', name: 'Insurance', group: 'administration', basis: 'fixed', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'licences', name: 'Licences', group: 'administration', basis: 'fixed', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'books', name: 'Books', group: 'academic', basis: 'perStudent', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'software', name: 'Software', group: 'technology', basis: 'perStudent', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'marketing', name: 'Marketing', group: 'marketing', basis: 'pctOfRevenue', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'professional-fees', name: 'Professional fees', group: 'administration', basis: 'fixed', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'transport', name: 'Transport', group: 'transport', basis: 'perStudent', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
  { id: 'catering', name: 'Catering', group: 'catering', basis: 'perStudent', amount: 0, stepSizeStudents: 50, escalationPct: 0, startYearIndex: 0, endYearIndex: null },
]
