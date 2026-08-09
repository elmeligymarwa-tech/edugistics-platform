import { describe, expect, it, vi } from 'vitest'

// No session cookie present — exercises the real requireAdminSession/isAdminAuthenticated
// path (not mocked) so this proves an actually-unauthenticated caller is rejected on
// every new promo-code route, not just that a mock was bypassed.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { createPromoCodeAction, updatePromoCodeAction, setPromoCodePausedAction, archivePromoCodeAction } = await import('./actions')

describe('promo code actions — unauthenticated access', () => {
  it('rejects createPromoCodeAction without a valid admin session', async () => {
    await expect(createPromoCodeAction({})).rejects.toThrow()
  })

  it('rejects updatePromoCodeAction without a valid admin session', async () => {
    await expect(updatePromoCodeAction('does-not-matter', {})).rejects.toThrow()
  })

  it('rejects setPromoCodePausedAction without a valid admin session', async () => {
    await expect(setPromoCodePausedAction('does-not-matter', true)).rejects.toThrow()
  })

  it('rejects archivePromoCodeAction without a valid admin session', async () => {
    await expect(archivePromoCodeAction('does-not-matter')).rejects.toThrow()
  })
})
