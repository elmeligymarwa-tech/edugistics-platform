import { describe, expect, it, vi } from 'vitest'

// No session cookie present — exercises the real requireAdminSession/isAdminAuthenticated
// path (not mocked) so this test proves an actually-unauthenticated caller is
// rejected, not just that a mock was bypassed.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))

const { getSubscriberSelectionSummaryAction, manualUnsubscribeAction, manualResubscribeAction } = await import('./actions')

describe('subscribers actions — unauthenticated access', () => {
  it('rejects getSubscriberSelectionSummaryAction without a valid admin session', async () => {
    await expect(getSubscriberSelectionSummaryAction({ mode: 'ids', subscriberIds: ['does-not-matter'] })).rejects.toThrow()
  })

  it('rejects manualUnsubscribeAction without a valid admin session', async () => {
    await expect(manualUnsubscribeAction('does-not-matter')).rejects.toThrow()
  })

  it('rejects manualResubscribeAction without a valid admin session', async () => {
    await expect(manualResubscribeAction('does-not-matter', 'RESUBSCRIBE')).rejects.toThrow()
  })
})
