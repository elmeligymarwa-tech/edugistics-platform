import { describe, expect, it } from 'vitest'

import { toSafeInternalPath } from './safe-redirect'

describe('toSafeInternalPath', () => {
  it('accepts a plain internal path', () => {
    expect(toSafeInternalPath('/dashboard')).toBe('/dashboard')
  })

  it('accepts an internal path with a query string', () => {
    expect(toSafeInternalPath('/revenue?year=2027')).toBe('/revenue?year=2027')
  })

  it('rejects null and undefined', () => {
    expect(toSafeInternalPath(null)).toBeNull()
    expect(toSafeInternalPath(undefined)).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(toSafeInternalPath('')).toBeNull()
  })

  it('rejects an absolute external URL', () => {
    expect(toSafeInternalPath('https://evil.example.com/phish')).toBeNull()
  })

  it('rejects a protocol-relative URL', () => {
    expect(toSafeInternalPath('//evil.example.com')).toBeNull()
  })

  it('rejects a backslash-based bypass attempt', () => {
    expect(toSafeInternalPath('/\\evil.example.com')).toBeNull()
  })

  it('rejects a path that does not start with a slash', () => {
    expect(toSafeInternalPath('dashboard')).toBeNull()
  })
})
