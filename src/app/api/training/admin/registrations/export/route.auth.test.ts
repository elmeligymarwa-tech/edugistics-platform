import { describe, expect, it, vi } from 'vitest'

// No session cookie present — exercises the real isAdminAuthenticated path
// (not mocked) so this proves an actually-unauthenticated caller is
// rejected, not just that a mock was bypassed. Phase C substantially
// extends this route (it now also builds the Promo Codes sheet), so its
// auth check is re-verified here alongside every other promo-code route.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))

const { GET } = await import('./route')

describe('GET /api/training/admin/registrations/export — unauthenticated access', () => {
  it('rejects the export without a valid admin session', async () => {
    const request = new Request('http://localhost/api/training/admin/registrations/export') as Parameters<typeof GET>[0]
    const response = await GET(request)
    expect(response.status).toBe(401)
  })
})
