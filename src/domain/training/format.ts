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

/** Above this many session dates, formatCourseSessionList switches from listing every date to a "first to last, N sessions" summary — a judgement call since the spec gives no exact number, chosen so the common case (a handful of Saturdays) still lists in full. */
const SESSION_LIST_THRESHOLD = 5

/** "26 September 2026" — a plain calendar date with no weekday, used as the always-fully-shown final entry of a session list or range. */
function formatSessionDateFull(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

/** A date formatted relative to a reference date — day-only when month and year both match, day+month when only the year matches, and the full day+month+year otherwise. Drops information the reference date already states, so a list or range never repeats itself. */
function formatDateRelativeTo(date: Date, reference: Date): string {
  const sameYear = date.getUTCFullYear() === reference.getUTCFullYear()
  const sameMonth = sameYear && date.getUTCMonth() === reference.getUTCMonth()
  const options: Intl.DateTimeFormatOptions = sameMonth
    ? { day: 'numeric', timeZone: 'UTC' }
    : sameYear
      ? { day: 'numeric', month: 'long', timeZone: 'UTC' }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
  return new Intl.DateTimeFormat('en-GB', options).format(date)
}

/**
 * A multi-day course's specific session dates, formatted readably — same
 * UTC-formatting rationale as formatCourseDateLong (these are plain
 * calendar dates, not zoned instants, so there's no Cairo conversion to do;
 * the value chosen by the admin already *is* the Cairo calendar date).
 * Dates need not be consecutive or share a month/year (see
 * formatDateRelativeTo for how repeated month/year is dropped).
 *
 * "5, 12, 19 and 26 September 2026, 4 sessions" for SESSION_LIST_THRESHOLD
 * or fewer dates; "5 September to 20 December 2026, 8 sessions" beyond that.
 */
export function formatCourseSessionList(dates: Date[]): string {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const count = sorted.length
  const suffix = `${count} session${count === 1 ? '' : 's'}`
  const last = sorted[sorted.length - 1]!

  if (count > SESSION_LIST_THRESHOLD) {
    const firstLabel = formatDateRelativeTo(sorted[0]!, last)
    return `${firstLabel} to ${formatSessionDateFull(last)}, ${suffix}`
  }

  const labels = sorted.map((date, index) =>
    index === sorted.length - 1 ? formatSessionDateFull(date) : formatDateRelativeTo(date, last),
  )
  const listLabel = labels.length === 1 ? labels[0]! : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  return `${listLabel}, ${suffix}`
}

/** The one place that decides whether a course shows a single date or its session list — every display site (public card, confirmation screen, confirmation email, admin list) calls this rather than branching on isMultiDay itself. */
export function formatCourseDateOrSessions(course: { courseDate: Date; isMultiDay: boolean; sessions: Date[] }): string {
  if (course.isMultiDay && course.sessions.length > 0) return formatCourseSessionList(course.sessions)
  return formatCourseDateLong(course.courseDate)
}

/** startTime/endTime are entered by admins as Cairo wall-clock time (see CourseForm) and stored with no zone attached, so they're formatted literally, with "(Cairo time)" as the disambiguating label wherever this is shown to a visitor. */
export function formatCourseTimeRange(startTime: Date, endTime: Date): string {
  return `${dateToTimeString(startTime)}–${dateToTimeString(endTime)} (Cairo time)`
}

/**
 * Parses a `type="date"` input's raw value into a Date, or undefined if the
 * value is empty or not a real calendar date — never throws. A native date
 * input reports "" while a digit-by-digit entry is still incomplete (e.g.
 * the year not yet fully typed), and `new Date('')` is an Invalid Date that
 * would otherwise silently poison any state it's stored in. This is the one
 * guarded entry point every Date-typed date field must parse through rather
 * than calling `new Date(value)` directly.
 */
export function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * The inverse of parseDateInputValue — formats a Date back into a
 * `type="date"` input's value. Safe against a missing or invalid Date,
 * always returning '' rather than throwing, so a field that currently holds
 * no valid value (mid-typing, or simply unset) renders as empty instead of
 * crashing the form.
 */
export function toDateInputValue(date: Date | undefined | null): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
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
