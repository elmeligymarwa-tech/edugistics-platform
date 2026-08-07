import type { Project, YearGroupId } from '@/domain/schema'

/**
 * Reference data for the setup wizard. Not domain state — purely UI lookup
 * tables used to pre-fill fields the user can still edit freely.
 */

export interface CurrencyOption {
  code: string
  symbol: string
  decimalPlaces: number
  label: string
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'GBP', symbol: '£', decimalPlaces: 2, label: 'British pound' },
  { code: 'USD', symbol: '$', decimalPlaces: 2, label: 'US dollar' },
  { code: 'EUR', symbol: '€', decimalPlaces: 2, label: 'Euro' },
  { code: 'AED', symbol: 'د.إ', decimalPlaces: 2, label: 'UAE dirham' },
  { code: 'SAR', symbol: 'ر.س', decimalPlaces: 2, label: 'Saudi riyal' },
  { code: 'QAR', symbol: 'ر.ق', decimalPlaces: 2, label: 'Qatari riyal' },
  { code: 'KWD', symbol: 'د.ك', decimalPlaces: 3, label: 'Kuwaiti dinar' },
  { code: 'EGP', symbol: 'E£', decimalPlaces: 2, label: 'Egyptian pound' },
  { code: 'INR', symbol: '₹', decimalPlaces: 2, label: 'Indian rupee' },
  { code: 'SGD', symbol: 'S$', decimalPlaces: 2, label: 'Singapore dollar' },
]

export const LOCALE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-AE', label: 'English (UAE)' },
  { value: 'ar-AE', label: 'Arabic (UAE)' },
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { value: 'ar-EG', label: 'Arabic (Egypt)' },
  { value: 'fr-FR', label: 'French (France)' },
]

export const MONTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

export const FORECAST_YEAR_OPTIONS = [1, 3, 5, 10] as const

export const STAFF_SECTION_LABELS: Record<string, string> = {
  leadership: 'Leadership',
  teaching: 'Teaching',
  studentServices: 'Student services',
  administration: 'Administration',
  facilities: 'Facilities',
}

export const YEAR_GROUP_LABELS: Record<YearGroupId, string> = {
  FS1: 'FS1',
  FS2: 'FS2',
  Y1: 'Year 1',
  Y2: 'Year 2',
  Y3: 'Year 3',
  Y4: 'Year 4',
  Y5: 'Year 5',
  Y6: 'Year 6',
  Y7: 'Year 7',
  Y8: 'Year 8',
  IGCSE_Y9: 'IGCSE Year 9',
  IGCSE_Y10: 'IGCSE Year 10',
  IGCSE_Y11: 'IGCSE Year 11',
  IGCSE_Y12: 'IGCSE Year 12',
}

/** Human-readable list of what will be lost if a year group is deselected. */
export function describeYearGroupData(project: Project, group: YearGroupId): string[] {
  const items: string[] = []
  const capacity = project.capacity[group]

  if (
    capacity &&
    (capacity.classrooms > 0 ||
      capacity.studentsPerClassroom > 0 ||
      capacity.teachers > 0 ||
      capacity.teachingAssistants > 0 ||
      capacity.coTeachers > 0)
  ) {
    items.push('Classroom and staffing capacity settings')
  }

  const categoriesWithAmounts = project.fees.categories.filter(
    (category) => (project.fees.amounts[group]?.[category.id] ?? 0) > 0,
  )
  if (categoriesWithAmounts.length > 0) {
    items.push(
      `Fee amounts for ${categoriesWithAmounts.length} categor${categoriesWithAmounts.length === 1 ? 'y' : 'ies'}`,
    )
  }

  const intake = project.revenueAssumptions.newIntake[group]
  if (intake && intake.some((value) => value > 0)) {
    items.push('New intake figures')
  }

  if (project.revenueAssumptions.retentionPct[group] !== undefined) {
    items.push('A retention rate')
  }

  return items
}

export function yearGroupHasData(project: Project, group: YearGroupId): boolean {
  return describeYearGroupData(project, group).length > 0
}
