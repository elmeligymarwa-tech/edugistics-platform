import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export const CAIRO_TIME_ZONE = 'Africa/Cairo'

/** Interprets a "datetime-local" input value (no timezone) as Africa/Cairo wall-clock time and returns the correct UTC instant, regardless of the admin's browser timezone. */
export function cairoDateTimeLocalToUtc(value: string): Date {
  return fromZonedTime(value, CAIRO_TIME_ZONE)
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
