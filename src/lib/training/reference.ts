import { toZonedTime } from 'date-fns-tz'

import { CAIRO_TIME_ZONE } from '@/domain/training/timezone'

const REFERENCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Reference format EDU-YYYY-XXXXXX — YYYY is the Cairo calendar year, XXXXXX is six random uppercase alphanumeric characters. Collisions are handled by the caller retrying with a fresh call. */
export function generateRegistrationReference(now: Date = new Date()): string {
  const cairoYear = toZonedTime(now, CAIRO_TIME_ZONE).getFullYear()
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)]
  }
  return `EDU-${cairoYear}-${suffix}`
}
