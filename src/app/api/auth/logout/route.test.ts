import { describe, expect, it } from 'vitest'

import { SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { POST } from './route'

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const response = await POST()
    expect(response.status).toBe(200)

    const cookieHeader = response.headers.get('set-cookie') ?? ''
    expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(cookieHeader).toMatch(/Max-Age=0/)
  })
})
