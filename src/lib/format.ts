import type { ProjectMeta } from '@/domain/schema'

type CurrencyMeta = Pick<ProjectMeta, 'currencyCode' | 'decimalPlaces' | 'locale'>

/**
 * A currency figure and whether it represents a loss. Every negative value
 * renders bracketed with no minus sign — `text` already carries that
 * convention, so callers colour from `negative` rather than re-testing the
 * source number (which would drift from whatever rounding/threshold the
 * formatter applied).
 */
export interface FormattedCurrency {
  text: string
  negative: boolean
}

function moneyBody(abs: number, meta: CurrencyMeta): string {
  return abs.toLocaleString(meta.locale, {
    minimumFractionDigits: meta.decimalPlaces,
    maximumFractionDigits: meta.decimalPlaces,
  })
}

function compactMoneyBody(abs: number, meta: CurrencyMeta): string {
  if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(2)}bn`
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}m`
  if (abs >= 1_000) return `${Math.round(abs / 1_000).toLocaleString(meta.locale)}k`
  return moneyBody(abs, meta)
}

function wrapCurrency(code: string, body: string, negative: boolean): FormattedCurrency {
  return { text: negative ? `${code} (${body})` : `${code} ${body}`, negative }
}

/** Full currency figure using the three-letter ISO code, e.g. "EGP 12,345". A loss reads "EGP (12,345)". */
export function formatMoney(value: number, meta: CurrencyMeta): FormattedCurrency {
  const negative = value < 0
  return wrapCurrency(meta.currencyCode, moneyBody(Math.abs(value), meta), negative)
}

/** Compact currency figure for tiles, tables and tooltips, e.g. "EGP 12.3k" / "EGP 4.2m". A loss reads "EGP (4.2m)". */
export function formatCompactMoney(value: number, meta: CurrencyMeta): FormattedCurrency {
  const negative = value < 0
  return wrapCurrency(meta.currencyCode, compactMoneyBody(Math.abs(value), meta), negative)
}

/** Signed currency figure with a minus sign and no brackets/colour — for CSV exports and other plain-text contexts (e.g. the AI consultant digest). */
export function formatMoneySigned(value: number, meta: CurrencyMeta): string {
  return `${value < 0 ? '-' : ''}${meta.currencyCode} ${moneyBody(Math.abs(value), meta)}`
}

/** Signed compact currency figure with a minus sign and no brackets/colour — for chart axis ticks, where brackets read badly. */
export function formatCompactMoneySigned(value: number, meta: CurrencyMeta): string {
  return `${value < 0 ? '-' : ''}${meta.currencyCode} ${compactMoneyBody(Math.abs(value), meta)}`
}

/** Grouped whole-number figure, e.g. "1,284". */
export function formatNumber(value: number, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value))
}

/** Compact whole-number figure for axes, e.g. "1.3K". */
export function formatCompactNumber(value: number, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSeconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000))

  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`

  const diffMinutes = Math.round(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

export function formatDateTime(iso: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
