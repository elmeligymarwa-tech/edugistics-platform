import { describe, expect, it } from 'vitest'

import { deriveFirstName, renderPersonalization, usesZoomLinkToken, type PersonalizationValues } from './personalization'

const VALUES: PersonalizationValues = {
  firstName: 'Amina',
  fullName: 'Amina Hassan',
  courseName: 'Leading Change',
  courseDate: '12 September 2026',
  courseTime: '09:00–10:00 (Cairo time)',
  schoolName: 'Nile International School',
  zoomLink: 'https://zoom.us/j/123',
  reference: 'REF-001',
}

describe('renderPersonalization', () => {
  it('resolves every supported token to its value', () => {
    const template =
      'Hi {{firstName}} ({{fullName}}) — {{courseName}} on {{courseDate}} at {{courseTime}}. {{schoolName}}. {{zoomLink}} {{reference}}'
    const rendered = renderPersonalization(template, VALUES)
    expect(rendered).toBe(
      'Hi Amina (Amina Hassan) — Leading Change on 12 September 2026 at 09:00–10:00 (Cairo time). Nile International School. https://zoom.us/j/123 REF-001',
    )
  })

  it('substitutes an empty string, never the literal token, for a known token with no value', () => {
    const rendered = renderPersonalization('Join here: {{zoomLink}}', { ...VALUES, zoomLink: '' })
    expect(rendered).toBe('Join here: ')
    expect(rendered).not.toContain('{{')
  })

  it('substitutes an empty string for an unknown token, never leaking it literally', () => {
    const rendered = renderPersonalization('Hello {{madeUpToken}}!', VALUES)
    expect(rendered).toBe('Hello !')
    expect(rendered).not.toContain('{{')
  })
})

describe('deriveFirstName', () => {
  it('takes the first word of a multi-word full name', () => {
    expect(deriveFirstName('Amina Hassan')).toBe('Amina')
  })

  it('resolves a single-word full name to that word', () => {
    expect(deriveFirstName('Cher')).toBe('Cher')
  })

  it('falls back to a neutral greeting name when no name is available', () => {
    expect(deriveFirstName('   ')).toBe('there')
    expect(deriveFirstName('')).toBe('there')
  })
})

describe('usesZoomLinkToken', () => {
  it('detects the zoomLink token regardless of surrounding whitespace', () => {
    expect(usesZoomLinkToken('Join: {{zoomLink}}')).toBe(true)
    expect(usesZoomLinkToken('Join: {{ zoomLink }}')).toBe(true)
    expect(usesZoomLinkToken('No token here')).toBe(false)
  })
})
