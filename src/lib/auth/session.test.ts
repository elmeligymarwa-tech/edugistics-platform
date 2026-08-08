import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSessionToken,
  isSitePasswordConfigured,
  MissingSitePasswordError,
  verifyPassword,
  verifySessionToken,
} from './session'

describe('session', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_PASSWORD', 'correct-horse-battery-staple')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  describe('isSitePasswordConfigured', () => {
    it('is true when SITE_PASSWORD is set', () => {
      expect(isSitePasswordConfigured()).toBe(true)
    })

    it('is false when SITE_PASSWORD is missing', () => {
      vi.stubEnv('SITE_PASSWORD', '')
      expect(isSitePasswordConfigured()).toBe(false)
    })
  })

  describe('verifyPassword', () => {
    it('accepts the correct password', async () => {
      await expect(verifyPassword('correct-horse-battery-staple')).resolves.toBe(true)
    })

    it('rejects an incorrect password', async () => {
      await expect(verifyPassword('wrong-password')).resolves.toBe(false)
    })

    it('rejects an empty password', async () => {
      await expect(verifyPassword('')).resolves.toBe(false)
    })

    it('throws when SITE_PASSWORD is not configured', async () => {
      vi.stubEnv('SITE_PASSWORD', '')
      await expect(verifyPassword('anything')).rejects.toThrow(MissingSitePasswordError)
    })
  })

  describe('createSessionToken / verifySessionToken', () => {
    it('produces a token that verifies successfully', async () => {
      const token = await createSessionToken()
      await expect(verifySessionToken(token)).resolves.toBe(true)
    })

    it('never embeds the site password in the token', async () => {
      const token = await createSessionToken()
      expect(token).not.toContain('correct-horse-battery-staple')
    })

    it('rejects a missing cookie', async () => {
      await expect(verifySessionToken(undefined)).resolves.toBe(false)
      await expect(verifySessionToken(null)).resolves.toBe(false)
      await expect(verifySessionToken('')).resolves.toBe(false)
    })

    it('rejects a malformed token', async () => {
      await expect(verifySessionToken('not-a-real-token')).resolves.toBe(false)
      await expect(verifySessionToken('123456')).resolves.toBe(false)
      await expect(verifySessionToken('.signature-only')).resolves.toBe(false)
    })

    it('rejects a token with a tampered signature', async () => {
      const token = await createSessionToken()
      const [payload, signature] = token.split('.')
      const flippedChar = signature.at(0) === 'a' ? 'b' : 'a'
      const tampered = `${payload}.${flippedChar}${signature.slice(1)}`
      await expect(verifySessionToken(tampered)).resolves.toBe(false)
    })

    it('rejects a token with a tampered expiry payload', async () => {
      const token = await createSessionToken()
      const [, signature] = token.split('.')
      const farFuture = String(Date.now() + 1000 * 60 * 60 * 24 * 365)
      const tampered = `${farFuture}.${signature}`
      await expect(verifySessionToken(tampered)).resolves.toBe(false)
    })

    it('rejects an expired token', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const token = await createSessionToken()

      vi.setSystemTime(new Date('2026-02-15T00:00:00Z'))
      await expect(verifySessionToken(token)).resolves.toBe(false)
    })

    it('rejects a token signed under a different site password', async () => {
      const token = await createSessionToken()
      vi.stubEnv('SITE_PASSWORD', 'a-different-password')
      await expect(verifySessionToken(token)).resolves.toBe(false)
    })

    it('throws when creating a token without SITE_PASSWORD configured', async () => {
      vi.stubEnv('SITE_PASSWORD', '')
      await expect(createSessionToken()).rejects.toThrow(MissingSitePasswordError)
    })

    it('rejects any token when SITE_PASSWORD becomes unset', async () => {
      const token = await createSessionToken()
      vi.stubEnv('SITE_PASSWORD', '')
      await expect(verifySessionToken(token)).resolves.toBe(false)
    })
  })
})
