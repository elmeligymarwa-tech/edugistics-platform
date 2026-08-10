import { describe, expect, it, vi } from 'vitest'

// No session cookie present — exercises the real requireAdminSession/isAdminAuthenticated
// path (not mocked) so this test proves an actually-unauthenticated caller is
// rejected on every marketing-send-related route, not just that a mock was bypassed.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))

const {
  sendMarketingCampaignAction,
  getMarketingCampaignStatusAction,
  retryFailedMarketingRecipientsAction,
  sendTestMarketingEmailAction,
} = await import('./send-actions')

describe('marketing send actions — unauthenticated access', () => {
  it('rejects sendMarketingCampaignAction without a valid admin session', async () => {
    await expect(
      sendMarketingCampaignAction({
        criteria: { mode: 'ids', subscriberIds: ['does-not-matter'] },
        content: { subject: 'x', body: 'y' },
        confirmedCount: 1,
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow()
  })

  it('rejects getMarketingCampaignStatusAction without a valid admin session', async () => {
    await expect(getMarketingCampaignStatusAction('does-not-matter')).rejects.toThrow()
  })

  it('rejects retryFailedMarketingRecipientsAction without a valid admin session', async () => {
    await expect(retryFailedMarketingRecipientsAction('does-not-matter')).rejects.toThrow()
  })

  it('rejects sendTestMarketingEmailAction without a valid admin session', async () => {
    await expect(
      sendTestMarketingEmailAction({
        criteria: { mode: 'ids', subscriberIds: ['does-not-matter'] },
        content: { subject: 'x', body: 'y' },
        testAddress: 'admin@example.com',
      }),
    ).rejects.toThrow()
  })
})
