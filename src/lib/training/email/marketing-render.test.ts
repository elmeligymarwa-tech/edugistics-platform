import { describe, expect, it } from 'vitest'

import { toMarketingPersonalizationValues } from '@/domain/training/personalization'
import { renderMarketingEmail } from './marketing-render'

const footer = { unsubscribeUrl: 'https://edugistics.online/unsubscribe?token=abc123', contactEmail: 'info@edugistics.online' }

describe('renderMarketingEmail', () => {
  it('resolves {{firstName}}, {{fullName}} and {{schoolName}} tokens', () => {
    const values = toMarketingPersonalizationValues({ firstName: 'Jane', fullName: 'Jane Doe', schoolName: 'Cairo International School' })
    const rendered = renderMarketingEmail('Hi {{firstName}}', 'Hello {{fullName}} from {{schoolName}}.', values, footer)

    expect(rendered.subject).toBe('Hi Jane')
    expect(rendered.html).toContain('Jane Doe')
    expect(rendered.html).toContain('Cairo International School')
    expect(rendered.text).toContain('Jane Doe')
  })

  it('renders schoolName as an empty string for a subscriber with no school', () => {
    const values = toMarketingPersonalizationValues({ firstName: 'Jane', fullName: 'Jane Doe', schoolName: '' })
    const rendered = renderMarketingEmail('Subject', 'School: [{{schoolName}}]', values, footer)

    expect(rendered.html).toContain('School: []')
    expect(rendered.text).toContain('School: []')
  })

  it('every rendered email contains the recipient\'s unsubscribe link', () => {
    const values = toMarketingPersonalizationValues({ firstName: 'Jane', fullName: 'Jane Doe', schoolName: '' })
    const rendered = renderMarketingEmail('Subject', 'Body', values, footer)

    expect(rendered.html).toContain(footer.unsubscribeUrl)
    expect(rendered.text).toContain(footer.unsubscribeUrl)
  })

  it('includes the Edugistics name, a contact address, and the subscribed-because line', () => {
    const values = toMarketingPersonalizationValues({ firstName: 'Jane', fullName: 'Jane Doe', schoolName: '' })
    const rendered = renderMarketingEmail('Subject', 'Body', values, footer)

    expect(rendered.html).toContain('Edugistics')
    expect(rendered.html).toContain(footer.contactEmail)
    expect(rendered.html).toMatch(/subscribed to Edugistics updates/i)
    expect(rendered.text).toContain(footer.contactEmail)
    expect(rendered.text).toMatch(/subscribed to Edugistics updates/i)
  })

  it('no literal, unresolved token survives rendering, even a token this composer does not support', () => {
    const values = toMarketingPersonalizationValues({ firstName: 'Jane', fullName: 'Jane Doe', schoolName: '' })
    // {{courseName}} is a real PersonalizationToken but not one the marketing composer exposes —
    // toMarketingPersonalizationValues fills it with '', so even a stray use renders safely empty.
    const rendered = renderMarketingEmail('Subject', 'Course: {{courseName}}, Unknown: {{notARealToken}}', values, footer)

    expect(rendered.html).not.toContain('{{')
    expect(rendered.text).not.toContain('{{')
  })

  it('escapes HTML-special characters in a recipient\'s own values before rendering', () => {
    const values = toMarketingPersonalizationValues({ firstName: 'Jane', fullName: '<script>alert(1)</script>', schoolName: '' })
    const rendered = renderMarketingEmail('Subject', 'Hello {{fullName}}', values, footer)

    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).toContain('&lt;script&gt;')
  })
})
