'use client'

const CSS_COLOR_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--foreground',
  '--muted-foreground',
  '--border',
  '--primary',
  '--card',
] as const

export type PdfColorToken = (typeof CSS_COLOR_TOKENS)[number]
export type PdfTheme = Record<PdfColorToken, [number, number, number]>

/**
 * Resolves any CSS colour syntax (oklch, hsl, hex, ...) to an RGB triple by
 * letting the browser compute it, rather than parsing colour functions by
 * hand. jsPDF only accepts plain RGB.
 */
function resolveCssColorToRgb(rawValue: string): [number, number, number] {
  const probe = document.createElement('span')
  probe.style.color = rawValue
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  document.body.removeChild(probe)

  const match = /rgba?\(([^)]+)\)/.exec(resolved)
  if (!match) return [0, 0, 0]
  const parts = match[1]!.split(',').map((part) => Number.parseFloat(part.trim()))
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

/** Reads the app's resolved theme colours as RGB tuples for jsPDF, so reports reuse the on-screen palette. */
export function readPdfTheme(): PdfTheme {
  const root = getComputedStyle(document.documentElement)
  const theme = {} as PdfTheme
  for (const token of CSS_COLOR_TOKENS) {
    const raw = root.getPropertyValue(token).trim()
    theme[token] = raw ? resolveCssColorToRgb(raw) : [0, 0, 0]
  }
  return theme
}
