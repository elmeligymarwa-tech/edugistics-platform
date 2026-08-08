import { describe, expect, it } from 'vitest'

import { publicRegistrationSchema } from './registration-schema'

const validInput = {
  courseId: 'course-1',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+20 100 123 4567',
  schoolName: 'Cairo International School',
  subject: 'Mathematics',
  grade: 'Grade 7',
  address: '',
  marketingConsent: false,
  website: '',
}

describe('publicRegistrationSchema', () => {
  it('accepts a fully valid submission', () => {
    const result = publicRegistrationSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('normalises a blank address to null', () => {
    const result = publicRegistrationSchema.parse(validInput)
    expect(result.address).toBeNull()
  })

  it('keeps a non-blank address', () => {
    const result = publicRegistrationSchema.parse({ ...validInput, address: '12 Nile Street' })
    expect(result.address).toBe('12 Nile Street')
  })

  it.each(['courseId', 'fullName', 'email', 'phone', 'schoolName', 'subject', 'grade'])(
    'rejects a submission missing %s',
    (field) => {
      const result = publicRegistrationSchema.safeParse({ ...validInput, [field]: '' })
      expect(result.success).toBe(false)
    },
  )

  it('rejects an invalid email address', () => {
    const result = publicRegistrationSchema.safeParse({ ...validInput, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('defaults marketingConsent to false when omitted', () => {
    const withoutConsent: Partial<typeof validInput> = { ...validInput }
    delete withoutConsent.marketingConsent
    const result = publicRegistrationSchema.parse(withoutConsent)
    expect(result.marketingConsent).toBe(false)
  })

  it('passes a filled honeypot field through unchanged for the caller to check', () => {
    const result = publicRegistrationSchema.parse({ ...validInput, website: 'http://spam.example' })
    expect(result.website).toBe('http://spam.example')
  })
})
