import { describe, expect, it, vi } from 'vitest'

// No session cookie present — exercises the real requireAdminSession/isAdminAuthenticated
// path (not mocked, unlike email-actions.test.ts) so this test proves an
// actually-unauthenticated caller is rejected, not just that a mock was bypassed.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))

const { getRecipientSummaryAction, getTemplateForSelectionAction, previewCampaignAction } = await import('./email-actions')

describe('registrations email actions — unauthenticated access', () => {
  it('rejects getRecipientSummaryAction without a valid admin session', async () => {
    await expect(getRecipientSummaryAction({ mode: 'ids', registrationIds: ['does-not-matter'] })).rejects.toThrow()
  })

  it('rejects getTemplateForSelectionAction without a valid admin session', async () => {
    await expect(
      getTemplateForSelectionAction('REMINDER', { mode: 'ids', registrationIds: ['does-not-matter'] }),
    ).rejects.toThrow()
  })

  it('rejects previewCampaignAction without a valid admin session', async () => {
    await expect(
      previewCampaignAction({ mode: 'ids', registrationIds: ['does-not-matter'] }, { subject: 'x', body: 'y' }),
    ).rejects.toThrow()
  })
})
