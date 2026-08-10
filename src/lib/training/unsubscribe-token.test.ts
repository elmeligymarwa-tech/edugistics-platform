import { describe, expect, it } from 'vitest'

import { generateUnsubscribeToken } from './unsubscribe-token'

describe('generateUnsubscribeToken', () => {
  it('produces a URL-safe token with at least 32 bytes of entropy', () => {
    const token = generateUnsubscribeToken()
    // base64url of 32 bytes is 43 characters, no padding.
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('is unique across many generations', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateUnsubscribeToken()))
    expect(tokens.size).toBe(1000)
  })

  it('takes no input, so it cannot be derived from an email, a teacher id or any sequential value', () => {
    expect(generateUnsubscribeToken.length).toBe(0)
    expect(generateUnsubscribeToken()).not.toBe(generateUnsubscribeToken())
  })
})
