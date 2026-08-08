import { describe, expect, it } from 'vitest'

import { isCourseOpenForRegistration } from './registration-window'

const now = new Date('2026-03-01T12:00:00Z')

function course(overrides: Partial<Parameters<typeof isCourseOpenForRegistration>[0]> = {}) {
  return {
    isActive: true,
    archivedAt: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    ...overrides,
  }
}

describe('isCourseOpenForRegistration', () => {
  it('is closed when the course is not active', () => {
    expect(isCourseOpenForRegistration(course({ isActive: false }), now)).toBe(false)
  })

  it('is closed when the course is archived', () => {
    expect(isCourseOpenForRegistration(course({ archivedAt: new Date('2026-02-01T00:00:00Z') }), now)).toBe(false)
  })

  it('is open with no registration window set', () => {
    expect(isCourseOpenForRegistration(course(), now)).toBe(true)
  })

  it('is closed before registrationOpensAt', () => {
    const opens = new Date('2026-03-02T00:00:00Z')
    expect(isCourseOpenForRegistration(course({ registrationOpensAt: opens }), now)).toBe(false)
  })

  it('is open once past registrationOpensAt', () => {
    const opens = new Date('2026-02-28T00:00:00Z')
    expect(isCourseOpenForRegistration(course({ registrationOpensAt: opens }), now)).toBe(true)
  })

  it('is closed after registrationClosesAt', () => {
    const closes = new Date('2026-02-28T00:00:00Z')
    expect(isCourseOpenForRegistration(course({ registrationClosesAt: closes }), now)).toBe(false)
  })

  it('is open right up to registrationClosesAt inclusive', () => {
    expect(isCourseOpenForRegistration(course({ registrationClosesAt: now }), now)).toBe(true)
  })
})
