import { describe, expect, it, vi } from 'vitest'

// No session cookie present — exercises the real requireAdminSession/isAdminAuthenticated
// path (not mocked) so this test proves an actually-unauthenticated caller is
// rejected, not just that a mock was bypassed.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))

const {
  createMarketingTemplateAction,
  updateMarketingTemplateAction,
  duplicateMarketingTemplateAction,
  archiveMarketingTemplateAction,
} = await import('./actions')

describe('marketing templates actions — unauthenticated access', () => {
  it('rejects createMarketingTemplateAction without a valid admin session', async () => {
    await expect(createMarketingTemplateAction({ name: 'x', subject: 'x', bodyTemplate: 'x' })).rejects.toThrow()
  })

  it('rejects updateMarketingTemplateAction without a valid admin session', async () => {
    await expect(updateMarketingTemplateAction('does-not-matter', { name: 'x', subject: 'x', bodyTemplate: 'x' })).rejects.toThrow()
  })

  it('rejects duplicateMarketingTemplateAction without a valid admin session', async () => {
    await expect(duplicateMarketingTemplateAction('does-not-matter')).rejects.toThrow()
  })

  it('rejects archiveMarketingTemplateAction without a valid admin session', async () => {
    await expect(archiveMarketingTemplateAction('does-not-matter')).rejects.toThrow()
  })
})
