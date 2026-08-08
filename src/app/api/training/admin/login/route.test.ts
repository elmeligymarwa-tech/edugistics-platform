import { hash } from '@node-rs/argon2'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { POST } = await import('./route')

const CORRECT_PASSWORD = 'correct-horse-battery-staple'
let passwordHash: string

function makeRequest(body: unknown, ip: string) {
  return new Request('http://localhost/api/training/admin/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  }) as Parameters<typeof POST>[0]
}

let ipCounter = 0
function uniqueIp() {
  ipCounter += 1
  return `10.0.0.${ipCounter}`
}

describe('POST /api/training/admin/login', () => {
  beforeAll(async () => {
    passwordHash = await hash(CORRECT_PASSWORD)
  })

  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD_HASH', passwordHash)
    vi.stubEnv('ADMIN_SESSION_SECRET', 'training-admin-secret-for-tests')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a wrong password with 401 and sets no session cookie', async () => {
    const response = await POST(makeRequest({ password: 'not-the-password' }, uniqueIp()))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('accepts the correct password with 200 and sets a session cookie', async () => {
    const response = await POST(makeRequest({ password: CORRECT_PASSWORD }, uniqueIp()))
    expect(response.status).toBe(200)
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('edugistics_training_admin_session=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('returns 500 when admin authentication is not configured on the server', async () => {
    vi.stubEnv('ADMIN_PASSWORD_HASH', '')
    const response = await POST(makeRequest({ password: CORRECT_PASSWORD }, uniqueIp()))
    expect(response.status).toBe(500)
  })

  it('rate limits after 5 failed attempts from the same IP within the window', async () => {
    const ip = uniqueIp()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(makeRequest({ password: 'wrong' }, ip))
      expect(response.status).toBe(401)
    }
    const sixth = await POST(makeRequest({ password: 'wrong' }, ip))
    expect(sixth.status).toBe(429)

    // Even the correct password is rejected once the window is exhausted.
    const seventh = await POST(makeRequest({ password: CORRECT_PASSWORD }, ip))
    expect(seventh.status).toBe(429)
  })

  it('does not rate limit a different IP after another IP is exhausted', async () => {
    const exhaustedIp = uniqueIp()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await POST(makeRequest({ password: 'wrong' }, exhaustedIp))
    }
    await POST(makeRequest({ password: 'wrong' }, exhaustedIp)) // consumes the 429

    const freshIp = uniqueIp()
    const response = await POST(makeRequest({ password: CORRECT_PASSWORD }, freshIp))
    expect(response.status).toBe(200)
  })
})
