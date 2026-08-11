import { dateToTimeString } from './time'

/** Simple currency formatting for the training module — kept separate from src/lib/format.ts, which is built around the school-planning app's CurrencyMeta and shouldn't be reused for an unrelated domain. */
export function formatCourseFee(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount)}`
}

/** courseDate is a plain calendar date (Postgres DATE, no time-of-day) — formatted in UTC so the stored day never shifts under a non-UTC server or browser clock. */
export function formatCourseDateLong(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/**
 * Inclusive day count between a multi-day course's start and end date — both
 * plain calendar dates (Postgres DATE, UTC-midnight JS Date, no time-of-day),
 * so a straight millisecond difference is exact with no DST/timezone
 * correction needed. 12–15 September is 4 days (12, 13, 14, 15), hence +1.
 */
export function courseDayCount(courseDate: Date, endDate: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((endDate.getTime() - courseDate.getTime()) / MS_PER_DAY) + 1
}

/**
 * "12 to 15 September 2026, 4 days" — same UTC-formatting rationale as
 * formatCourseDateLong (a plain calendar date, not a zoned instant, so
 * there's no Cairo conversion to do; the value chosen by the admin already
 * *is* the Cairo calendar date). The start date drops the month/year when
 * they match the end date, and drops just the year when only that matches,
 * so a range never repeats information the end date already states.
 */
export function formatCourseDateRange(courseDate: Date, endDate: Date): string {
  const days = courseDayCount(courseDate, endDate)
  const sameYear = courseDate.getUTCFullYear() === endDate.getUTCFullYear()
  const sameMonth = sameYear && courseDate.getUTCMonth() === endDate.getUTCMonth()

  const startFormat: Intl.DateTimeFormatOptions = sameMonth
    ? { day: 'numeric', timeZone: 'UTC' }
    : sameYear
      ? { day: 'numeric', month: 'long', timeZone: 'UTC' }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }

  const startLabel = new Intl.DateTimeFormat('en-GB', startFormat).format(courseDate)
  const endLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(endDate)

  return `${startLabel} to ${endLabel}, ${days} day${days === 1 ? '' : 's'}`
}

/** The one place that decides whether a course shows a single date or a range — every display site (public card, confirmation screen, confirmation email, admin list) calls this rather than branching on isMultiDay itself. */
export function formatCourseDateOrRange(course: { courseDate: Date; endDate: Date | null; isMultiDay: boolean }): string {
  if (course.isMultiDay && course.endDate) return formatCourseDateRange(course.courseDate, course.endDate)
  return formatCourseDateLong(course.courseDate)
}

/** startTime/endTime are entered by admins as Cairo wall-clock time (see CourseForm) and stored with no zone attached, so they're formatted literally, with "(Cairo time)" as the disambiguating label wherever this is shown to a visitor. */
export function formatCourseTimeRange(startTime: Date, endTime: Date): string {
  return `${dateToTimeString(startTime)}–${dateToTimeString(endTime)} (Cairo time)`
}

/** registeredAt/cancelledAt/promotedAt are stored as UTC instants — shown to admins in Africa/Cairo wall-clock time, per the module's timezone rule. */
export function formatAdminTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(date)
}
