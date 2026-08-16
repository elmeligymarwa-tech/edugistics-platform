import { describe, expect, it } from 'vitest'

import { isPublicTrackedPath } from './config'

describe('isPublicTrackedPath', () => {
  it('allows the landing page', () => {
    expect(isPublicTrackedPath('/')).toBe(true)
  })

  it('allows the training registration page', () => {
    expect(isPublicTrackedPath('/training')).toBe(true)
  })

  it('allows the training privacy notice', () => {
    expect(isPublicTrackedPath('/training/privacy')).toBe(true)
  })

  it('allows the unsubscribe page', () => {
    expect(isPublicTrackedPath('/unsubscribe')).toBe(true)
  })

  it('excludes every /training/admin route', () => {
    expect(isPublicTrackedPath('/training/admin')).toBe(false)
    expect(isPublicTrackedPath('/training/admin/login')).toBe(false)
    expect(isPublicTrackedPath('/training/admin/registrations')).toBe(false)
    expect(isPublicTrackedPath('/training/admin/registrations/abc123')).toBe(false)
    expect(isPublicTrackedPath('/training/admin/subscribers/campaigns/xyz')).toBe(false)
  })

  it('excludes every /app route', () => {
    expect(isPublicTrackedPath('/app')).toBe(false)
    expect(isPublicTrackedPath('/app/dashboard')).toBe(false)
    expect(isPublicTrackedPath('/app/setup')).toBe(false)
    expect(isPublicTrackedPath('/app/statements')).toBe(false)
  })

  it('excludes the login and unrelated api routes', () => {
    expect(isPublicTrackedPath('/login')).toBe(false)
    expect(isPublicTrackedPath('/api/training/register')).toBe(false)
  })

  it('excludes an unknown path rather than matching by prefix', () => {
    expect(isPublicTrackedPath('/training/privacy/extra')).toBe(false)
    expect(isPublicTrackedPath('/trainingsomethingelse')).toBe(false)
  })
})
