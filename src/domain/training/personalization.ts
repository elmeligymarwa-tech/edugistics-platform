export const PERSONALIZATION_TOKENS = [
  'firstName',
  'fullName',
  'courseName',
  'courseDate',
  'courseTime',
  'schoolName',
  'zoomLink',
  'reference',
] as const

export type PersonalizationToken = (typeof PERSONALIZATION_TOKENS)[number]

export type PersonalizationValues = Record<PersonalizationToken, string>

const KNOWN_TOKENS = new Set<string>(PERSONALIZATION_TOKENS)
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z]+)\s*\}\}/g

/**
 * Replaces every {{token}} in the input with its resolved value. Unknown
 * tokens and known tokens with no value both resolve to an empty string —
 * a literal {{token}} must never reach a recipient.
 */
export function renderPersonalization(template: string, values: PersonalizationValues): string {
  return template.replace(TOKEN_PATTERN, (_match, name: string) => {
    if (KNOWN_TOKENS.has(name)) return values[name as PersonalizationToken] ?? ''
    return ''
  })
}

/**
 * First name derived from a stored full name. A single-word name resolves to
 * that word; a neutral greeting name is used only when no name is available
 * at all (e.g. a blank or whitespace-only full name).
 */
export function deriveFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0]
  return first || 'there'
}

/** True when the given template text (subject or body) references {{zoomLink}}. */
export function usesZoomLinkToken(template: string): boolean {
  return /\{\{\s*zoomLink\s*\}\}/.test(template)
}

/** The tokens listed visibly in the subscriber composer (Phase C) — a subset of the full registration-campaign token set, since a marketing recipient has no course, date, time, Zoom link or registration reference. */
export const MARKETING_PERSONALIZATION_TOKENS = ['firstName', 'fullName', 'schoolName'] as const satisfies readonly PersonalizationToken[]

/** Fills every PersonalizationToken renderPersonalization needs, leaving the tokens a marketing email never uses as empty strings — renderPersonalization already turns an unmatched or valueless token into '', so a stray {{courseName}} typed into a marketing template still renders safely rather than surviving literally. */
export function toMarketingPersonalizationValues(values: { firstName: string; fullName: string; schoolName: string }): PersonalizationValues {
  return {
    firstName: values.firstName,
    fullName: values.fullName,
    schoolName: values.schoolName,
    courseName: '',
    courseDate: '',
    courseTime: '',
    zoomLink: '',
    reference: '',
  }
}
