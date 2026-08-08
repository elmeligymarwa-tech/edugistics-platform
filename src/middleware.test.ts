import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { middleware } from './middleware'

const BASE_URL = 'https://app.example.com'

function requestFor(path: string, cookie?: string) {
  const headers = cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : undefined
  return new NextRequest(new URL(path, BASE_URL), { headers })
}

describe('middleware', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_PASSWORD', 'correct-horse-battery-staple')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fails safely with a 500 when SITE_PASSWORD is missing', async () => {
    vi.stubEnv('SITE_PASSWORD', '')
    const response = await middleware(requestFor('/dashboard'))
    expect(response.status).toBe(500)
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects an unauthenticated request to /login, preserving the original path', async () => {
    const response = await middleware(requestFor('/dashboard'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('from')).toBe('/dashboard')
  })

  it('preserves query parameters in the original URL', async () => {
    const response = await middleware(requestFor('/revenue?year=2027'))
    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('from')).toBe('/revenue?year=2027')
  })

  it('redirects when there is no session cookie at all', async () => {
    const response = await middleware(requestFor('/dashboard'))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
  })

  it('redirects and clears the cookie for a tampered session token', async () => {
    const token = await createSessionToken()
    const tampered = `${token}-tampered`
    const response = await middleware(requestFor('/dashboard', tampered))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('')
  })

  it('redirects for an expired session token', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = await createSessionToken()
    vi.setSystemTime(new Date('2026-02-15T00:00:00Z'))

    const response = await middleware(requestFor('/dashboard', token))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
    vi.useRealTimers()
  })

  it('allows a request through with a valid session and disables caching', async () => {
    const token = await createSessionToken()
    const response = await middleware(requestFor('/dashboard', token))
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('lets an unauthenticated visitor reach /login', async () => {
    const response = await middleware(requestFor('/login'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects an authenticated visitor away from /login to the app', async () => {
    const token = await createSessionToken()
    const response = await middleware(requestFor('/login', token))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard')
  })

  it('redirects an authenticated visitor to the preserved "from" target', async () => {
    const token = await createSessionToken()
    const response = await middleware(requestFor('/login?from=%2Frevenue', token))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/revenue')
  })

  it('refuses to honour an external open-redirect target from /login', async () => {
    const token = await createSessionToken()
    const response = await middleware(
      requestFor(`/login?from=${encodeURIComponent('https://evil.example.com')}`, token),
    )
    const location = new URL(response.headers.get('location')!)
    expect(location.hostname).toBe('app.example.com')
    expect(location.pathname).toBe('/dashboard')
  })

  it('refuses a protocol-relative open-redirect target from /login', async () => {
    const token = await createSessionToken()
    const response = await middleware(
      requestFor(`/login?from=${encodeURIComponent('//evil.example.com')}`, token),
    )
    const location = new URL(response.headers.get('location')!)
    expect(location.hostname).toBe('app.example.com')
  })

  it('leaves public static asset paths unauthenticated and unredirected', async () => {
    const response = await middleware(requestFor('/icons/icon-192.png'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves the PWA manifest unauthenticated', async () => {
    const response = await middleware(requestFor('/manifest.webmanifest'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves the service worker script unauthenticated', async () => {
    const response = await middleware(requestFor('/sw.js'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('bypasses auth entirely for the auth API routes, even when misconfigured', async () => {
    vi.stubEnv('SITE_PASSWORD', '')
    const response = await middleware(requestFor('/api/auth/login'))
    expect(response.status).not.toBe(500)
    expect(response.headers.get('location')).toBeNull()
  })
})
