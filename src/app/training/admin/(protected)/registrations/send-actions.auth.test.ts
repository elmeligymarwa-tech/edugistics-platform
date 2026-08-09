import { describe, expect, it, vi } from 'vitest'

// No session cookie present — exercises the real requireAdminSession/isAdminAuthenticated
// path (not mocked) so this test proves an actually-unauthenticated caller is
// rejected on every send-related route, not just that a mock was bypassed.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))

const { sendCampaignAction, getCampaignStatusAction, retryFailedRecipientsAction, sendTestEmailAction } = await import('./send-actions')

describe('bulk send actions — unauthenticated access', () => {
  it('rejects sendCampaignAction without a valid admin session', async () => {
    await expect(
      sendCampaignAction({
        criteria: { mode: 'ids', registrationIds: ['does-not-matter'] },
        emailType: 'CUSTOM',
        content: { subject: 'x', body: 'y' },
        confirmedCount: 1,
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow()
  })

  it('rejects getCampaignStatusAction without a valid admin session', async () => {
    await expect(getCampaignStatusAction('does-not-matter')).rejects.toThrow()
  })

  it('rejects retryFailedRecipientsAction without a valid admin session', async () => {
    await expect(retryFailedRecipientsAction('does-not-matter')).rejects.toThrow()
  })

  it('rejects sendTestEmailAction without a valid admin session', async () => {
    await expect(
      sendTestEmailAction({
        criteria: { mode: 'ids', registrationIds: ['does-not-matter'] },
        content: { subject: 'x', body: 'y' },
        testAddress: 'admin@example.com',
      }),
    ).rejects.toThrow()
  })
})
