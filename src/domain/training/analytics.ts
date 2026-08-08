import { toZonedTime } from 'date-fns-tz'

import type { CourseCategory } from './schema'
import { CAIRO_TIME_ZONE, cairoDateTimeLocalToUtc } from './timezone'

export type RegistrationStatusFilter = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'

export type TeacherEngagementType = 'NEW' | 'ENGAGED' | 'HIGHLY_ENGAGED'

export const TEACHER_ENGAGEMENT_LABELS: Record<TeacherEngagementType, string> = {
  NEW: 'New',
  ENGAGED: 'Engaged',
  HIGHLY_ENGAGED: 'Highly engaged',
}

export type TrendGranularity = 'DAY' | 'WEEK' | 'MONTH'

/**
 * The single filter shape every analytics query accepts. A view must build
 * one AnalyticsFilters object from the URL and pass the same object to every
 * query it makes — mixing a filtered call with an unfiltered one inside the
 * same view is what produces panels that disagree with each other.
 */
export interface AnalyticsFilters {
  dateFrom?: Date
  dateTo?: Date
  courseIds?: string[]
  categories?: CourseCategory[]
  schoolIds?: string[]
  subjects?: string[]
  grades?: string[]
  teacherType?: TeacherEngagementType[]
  status?: RegistrationStatusFilter[]
  marketingConsent?: boolean
}

export type DateRangePreset =
  | 'TODAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'ALL_TIME'
  | 'CUSTOM'

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  'TODAY',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_YEAR',
  'ALL_TIME',
  'CUSTOM',
]

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  TODAY: 'Today',
  LAST_7_DAYS: 'Last 7 Days',
  LAST_30_DAYS: 'Last 30 Days',
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
  THIS_YEAR: 'This Year',
  ALL_TIME: 'All Time',
  CUSTOM: 'Custom Range',
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

interface CairoDateParts {
  year: number
  month: number
  day: number
}

function cairoDateParts(instant: Date): CairoDateParts {
  const zoned = toZonedTime(instant, CAIRO_TIME_ZONE)
  return { year: zoned.getFullYear(), month: zoned.getMonth() + 1, day: zoned.getDate() }
}

function dateStr({ year, month, day }: CairoDateParts): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Calendar-day arithmetic done in UTC on the Cairo Y/M/D parts — a pure day offset, so it's unaffected by any DST rule Cairo does or doesn't observe on a given date. */
function addCairoDays(parts: CairoDateParts, delta: number): CairoDateParts {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  d.setUTCDate(d.getUTCDate() + delta)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function cairoDayStart(parts: CairoDateParts): Date {
  return cairoDateTimeLocalToUtc(`${dateStr(parts)}T00:00:00.000`)
}

function cairoDayEnd(parts: CairoDateParts): Date {
  return cairoDateTimeLocalToUtc(`${dateStr(parts)}T23:59:59.999`)
}

/**
 * Resolves a date-range preset to concrete UTC instants, computed against
 * the Africa/Cairo calendar day — never UTC. CUSTOM resolves to an empty
 * range; the caller supplies dateFrom/dateTo directly for that preset.
 */
export function resolvePresetRange(preset: DateRangePreset, now: Date = new Date()): { dateFrom?: Date; dateTo?: Date } {
  const today = cairoDateParts(now)

  switch (preset) {
    case 'ALL_TIME':
    case 'CUSTOM':
      return {}
    case 'TODAY':
      return { dateFrom: cairoDayStart(today), dateTo: cairoDayEnd(today) }
    case 'LAST_7_DAYS':
      return { dateFrom: cairoDayStart(addCairoDays(today, -6)), dateTo: cairoDayEnd(today) }
    case 'LAST_30_DAYS':
      return { dateFrom: cairoDayStart(addCairoDays(today, -29)), dateTo: cairoDayEnd(today) }
    case 'THIS_MONTH':
      return { dateFrom: cairoDayStart({ ...today, day: 1 }), dateTo: cairoDayEnd(today) }
    case 'LAST_MONTH': {
      const lastDayOfPrevMonth = addCairoDays({ ...today, day: 1 }, -1)
      return {
        dateFrom: cairoDayStart({ ...lastDayOfPrevMonth, day: 1 }),
        dateTo: cairoDayEnd(lastDayOfPrevMonth),
      }
    }
    case 'THIS_YEAR':
      return { dateFrom: cairoDayStart({ year: today.year, month: 1, day: 1 }), dateTo: cairoDayEnd(today) }
  }
}

/** A custom range's plain "YYYY-MM-DD" bounds, interpreted as the Cairo calendar day they name — start of day for dateFrom, end of day for dateTo. */
export function customCairoDateRange(from: string | undefined, to: string | undefined): { dateFrom?: Date; dateTo?: Date } {
  return {
    dateFrom: from ? cairoDateTimeLocalToUtc(`${from}T00:00:00.000`) : undefined,
    dateTo: to ? cairoDateTimeLocalToUtc(`${to}T23:59:59.999`) : undefined,
  }
}

function splitParam(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : undefined
}

export interface ParsedAnalyticsSearchParams {
  filters: AnalyticsFilters
  preset: DateRangePreset
  customFrom?: string
  customTo?: string
}

/**
 * Parses the dashboard's URL search params into the one AnalyticsFilters
 * object every query on the page shares. Only the six dimensions in the
 * global filter bar (date range, course, category, school, subject, grade)
 * are wired here — teacherType, status and marketingConsent stay available
 * on the type for callers that need them (e.g. tests) without a UI control.
 */
export function parseAnalyticsSearchParams(params: Record<string, string | undefined>): ParsedAnalyticsSearchParams {
  const preset: DateRangePreset = DATE_RANGE_PRESETS.includes(params.range as DateRangePreset)
    ? (params.range as DateRangePreset)
    : 'ALL_TIME'
  const { dateFrom, dateTo } = preset === 'CUSTOM' ? customCairoDateRange(params.from, params.to) : resolvePresetRange(preset)

  const filters: AnalyticsFilters = {
    dateFrom,
    dateTo,
    courseIds: splitParam(params.courseIds),
    categories: splitParam(params.categories) as CourseCategory[] | undefined,
    schoolIds: splitParam(params.schoolIds),
    subjects: splitParam(params.subjects),
    grades: splitParam(params.grades),
  }

  return { filters, preset, customFrom: params.from, customTo: params.to }
}
