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
