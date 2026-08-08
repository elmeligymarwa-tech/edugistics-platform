import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'
import { POST } from './route'

function loginRequest(body: unknown) {
  return new NextRequest(new URL('/api/auth/login', 'https://app.example.com'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setCookieHeader(response: Response) {
  return response.headers.get('set-cookie') ?? ''
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_PASSWORD', 'correct-horse-battery-staple')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 500 and sets no cookie when SITE_PASSWORD is missing', async () => {
    vi.stubEnv('SITE_PASSWORD', '')
    const response = await POST(loginRequest({ password: 'anything' }))
    expect(response.status).toBe(500)
    expect(setCookieHeader(response)).toBe('')
  })

  it('rejects an incorrect password', async () => {
    const response = await POST(loginRequest({ password: 'wrong' }))
    expect(response.status).toBe(401)
    expect(setCookieHeader(response)).toBe('')
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  it('rejects an empty password', async () => {
    const response = await POST(loginRequest({ password: '' }))
    expect(response.status).toBe(401)
  })

  it('rejects a malformed request body', async () => {
    const response = await POST(
      new NextRequest(new URL('/api/auth/login', 'https://app.example.com'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    )
    expect(response.status).toBe(400)
  })

  it('accepts the correct password and sets a secure, httpOnly, sameSite=strict, 30-day cookie', async () => {
    const response = await POST(loginRequest({ password: 'correct-horse-battery-staple' }))
    expect(response.status).toBe(200)

    const cookieHeader = setCookieHeader(response)
    expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('SameSite=strict')
    expect(cookieHeader).toContain('Path=/')
    expect(cookieHeader).toContain('Max-Age=2592000')

    const token = response.cookies.get(SESSION_COOKIE_NAME)?.value
    await expect(verifySessionToken(token)).resolves.toBe(true)
  })

  it('marks the cookie Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = await POST(loginRequest({ password: 'correct-horse-battery-staple' }))
    expect(setCookieHeader(response)).toContain('Secure')
  })

  it('does not mark the cookie Secure outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const response = await POST(loginRequest({ password: 'correct-horse-battery-staple' }))
    expect(setCookieHeader(response)).not.toContain('Secure')
  })

  it('never returns the site password in the response body', async () => {
    const response = await POST(loginRequest({ password: 'wrong' }))
    const text = await response.text()
    expect(text).not.toContain('correct-horse-battery-staple')
  })
})
