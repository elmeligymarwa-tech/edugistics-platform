import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { ADMIN_SESSION_COOKIE_NAME, createAdminSessionToken } from '@/lib/training/auth/admin-session'
import { middleware } from './middleware'

const BASE_URL = 'https://app.example.com'

function requestFor(path: string, cookie?: string) {
  const headers = cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : undefined
  return new NextRequest(new URL(path, BASE_URL), { headers })
}

function requestForAdmin(path: string, cookie?: string) {
  const headers = cookie ? { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${cookie}` } : undefined
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
    const response = await middleware(requestFor('/app/dashboard'))
    expect(response.status).toBe(500)
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves the public landing page reachable even when SITE_PASSWORD is missing', async () => {
    vi.stubEnv('SITE_PASSWORD', '')
    const response = await middleware(requestFor('/'))
    expect(response.status).not.toBe(500)
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves the root landing page unauthenticated and unredirected', async () => {
    const response = await middleware(requestFor('/'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves /unsubscribe reachable without a session, even when SITE_PASSWORD is missing — reached from a link inside an email, not a browser session', async () => {
    vi.stubEnv('SITE_PASSWORD', '')
    const response = await middleware(requestFor('/unsubscribe?token=abc123'))
    expect(response.status).not.toBe(500)
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects an unauthenticated request to /login, preserving the original path', async () => {
    const response = await middleware(requestFor('/app/dashboard'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('from')).toBe('/app/dashboard')
  })

  it('preserves query parameters in the original URL', async () => {
    const response = await middleware(requestFor('/app/revenue?year=2027'))
    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('from')).toBe('/app/revenue?year=2027')
  })

  it('redirects when there is no session cookie at all', async () => {
    const response = await middleware(requestFor('/app/dashboard'))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
  })

  it('redirects and clears the cookie for a tampered session token', async () => {
    const token = await createSessionToken()
    const tampered = `${token}-tampered`
    const response = await middleware(requestFor('/app/dashboard', tampered))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe('')
  })

  it('redirects for an expired session token', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = await createSessionToken()
    vi.setSystemTime(new Date('2026-02-15T00:00:00Z'))

    const response = await middleware(requestFor('/app/dashboard', token))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
    vi.useRealTimers()
  })

  it('allows a request through with a valid session and disables caching', async () => {
    const token = await createSessionToken()
    const response = await middleware(requestFor('/app/dashboard', token))
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
    expect(new URL(response.headers.get('location')!).pathname).toBe('/app/dashboard')
  })

  it('redirects an authenticated visitor to the preserved "from" target', async () => {
    const token = await createSessionToken()
    const response = await middleware(requestFor('/login?from=%2Fapp%2Frevenue', token))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/app/revenue')
  })

  it('refuses to honour an external open-redirect target from /login', async () => {
    const token = await createSessionToken()
    const response = await middleware(
      requestFor(`/login?from=${encodeURIComponent('https://evil.example.com')}`, token),
    )
    const location = new URL(response.headers.get('location')!)
    expect(location.hostname).toBe('app.example.com')
    expect(location.pathname).toBe('/app/dashboard')
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

describe('middleware — training module', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'training-admin-secret-for-tests')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('never gates public /training pages behind the school-planning SITE_PASSWORD, even when it is missing', async () => {
    vi.stubEnv('SITE_PASSWORD', '')
    const response = await middleware(requestFor('/training'))
    expect(response.status).not.toBe(500)
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves the public registration API reachable with no admin session', async () => {
    const response = await middleware(requestForAdmin('/api/training/register'))
    expect(response.status).not.toBe(401)
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves the training privacy notice page reachable with no admin session', async () => {
    const response = await middleware(requestForAdmin('/training/privacy'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('leaves the admin login page reachable with no admin session', async () => {
    const response = await middleware(requestForAdmin('/training/admin/login'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects an unauthenticated request to a training admin page to the training login', async () => {
    const response = await middleware(requestForAdmin('/training/admin'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/training/admin/login')
  })

  it('redirects unauthenticated requests to nested training admin pages', async () => {
    const response = await middleware(requestForAdmin('/training/admin/registrations'))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/training/admin/login')
  })

  it('rejects an unauthenticated training admin API call with 401 JSON, not a redirect', async () => {
    const response = await middleware(requestForAdmin('/api/training/admin/registrations/export'))
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toMatch(/admin session/i)
  })

  it('rejects a tampered training admin session token and clears the cookie', async () => {
    const token = await createAdminSessionToken()
    const response = await middleware(requestForAdmin('/training/admin', `${token}-tampered`))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/training/admin/login')
    expect(response.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value).toBe('')
  })

  it('rejects an expired training admin session token', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = await createAdminSessionToken()
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z')) // past the 8-hour expiry

    const response = await middleware(requestForAdmin('/training/admin', token))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/training/admin/login')
    vi.useRealTimers()
  })

  it('does not accept the school-planning SITE_PASSWORD session as a training admin session', async () => {
    vi.stubEnv('SITE_PASSWORD', 'correct-horse-battery-staple')
    const siteToken = await createSessionToken()
    const response = await middleware(
      new NextRequest(new URL('/training/admin', BASE_URL), {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${siteToken}` },
      }),
    )
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/training/admin/login')
  })

  it('allows a request through with a valid training admin session and disables caching', async () => {
    const token = await createAdminSessionToken()
    const response = await middleware(requestForAdmin('/training/admin/courses', token))
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('allows an authenticated training admin API call through', async () => {
    const token = await createAdminSessionToken()
    const response = await middleware(requestForAdmin('/api/training/admin/registrations/export', token))
    expect(response.status).not.toBe(401)
    expect(response.headers.get('location')).toBeNull()
  })
})
