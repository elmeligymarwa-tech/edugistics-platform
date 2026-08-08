import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export const CAIRO_TIME_ZONE = 'Africa/Cairo'

/** Interprets a "datetime-local" input value (no timezone) as Africa/Cairo wall-clock time and returns the correct UTC instant, regardless of the admin's browser timezone. */
export function cairoDateTimeLocalToUtc(value: string): Date {
  return fromZonedTime(value, CAIRO_TIME_ZONE)
}

/** Reduces a UTC instant to its Africa/Cairo calendar day, expressed as a UTC-midnight Date — the same "pure date" shape Postgres DATE columns already come back as, so date-only spreadsheet cells and admin-table groupings agree with each other regardless of server timezone. */
export function toCairoCalendarDate(date: Date): Date {
  const zoned = toZonedTime(date, CAIRO_TIME_ZONE)
  return new Date(Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate()))
}

/** Formats a UTC instant as a "datetime-local" input value (YYYY-MM-DDTHH:mm) in Africa/Cairo wall-clock time. */
export function utcToCairoDateTimeLocal(date: Date): string {
  const zoned = toZonedTime(date, CAIRO_TIME_ZONE)
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = zoned.getFullYear()
  const month = pad(zoned.getMonth() + 1)
  const day = pad(zoned.getDate())
  const hours = pad(zoned.getHours())
  const minutes = pad(zoned.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
