import type { ProjectMeta } from '@/domain/schema'

type CurrencyMeta = Pick<ProjectMeta, 'currencyCode' | 'currencySymbol' | 'decimalPlaces' | 'locale'>

/** Full currency figure, e.g. "£12,345". Falls back to symbol + grouped number if the currency code isn't ISO-recognised. */
export function formatMoney(value: number, meta: CurrencyMeta): string {
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.currencyCode,
      minimumFractionDigits: meta.decimalPlaces,
      maximumFractionDigits: meta.decimalPlaces,
    }).format(value)
  } catch {
    const number = new Intl.NumberFormat(meta.locale, {
      minimumFractionDigits: meta.decimalPlaces,
      maximumFractionDigits: meta.decimalPlaces,
    }).format(value)
    return `${meta.currencySymbol}${number}`
  }
}

/** Compact currency figure for axes and tiles, e.g. "£12.3K" / "£4.2M". */
export function formatCompactMoney(value: number, meta: CurrencyMeta): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${meta.currencySymbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${meta.currencySymbol}${(abs / 1_000).toFixed(1)}K`
  return formatMoney(value, meta)
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
