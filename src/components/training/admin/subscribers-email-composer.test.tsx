// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const previewMarketingEmailAction = vi.fn()
vi.mock('@/app/training/admin/(protected)/subscribers/actions', () => ({
  previewMarketingEmailAction: (...args: unknown[]) => previewMarketingEmailAction(...args),
}))

const sendMarketingCampaignAction = vi.fn()
const sendTestMarketingEmailAction = vi.fn()
vi.mock('@/app/training/admin/(protected)/subscribers/send-actions', () => ({
  sendMarketingCampaignAction: (...args: unknown[]) => sendMarketingCampaignAction(...args),
  sendTestMarketingEmailAction: (...args: unknown[]) => sendTestMarketingEmailAction(...args),
}))

const { SubscribersEmailComposer } = await import('./subscribers-email-composer')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const criteria = { mode: 'ids' as const, subscriberIds: ['sub-1'] }

// "Send Test to Myself" lives on the compose step, so no preview round trip is needed to reach it.
function renderComposer() {
  render(<SubscribersEmailComposer open onOpenChange={() => {}} criteria={criteria} templates={[]} />)
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'admin@example.com' } })
}

describe('SubscribersEmailComposer — Send Test to Myself', () => {
  it('reaches a success state after a successful test send, and the button is usable again', async () => {
    sendTestMarketingEmailAction.mockResolvedValueOnce({ success: true, data: { messageId: 'msg-1' } })
    renderComposer()

    fireEvent.click(screen.getByRole('button', { name: 'Send Test to Myself' }))

    await waitFor(() => expect(screen.getByText('Test email sent — check the inbox.')).toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Send Test to Myself' })
    expect(button).toBeEnabled()

    // Usable again: a second click fires a second request rather than staying inert.
    sendTestMarketingEmailAction.mockResolvedValueOnce({ success: true, data: { messageId: 'msg-2' } })
    fireEvent.click(button)
    await waitFor(() => expect(sendTestMarketingEmailAction).toHaveBeenCalledTimes(2))
  })

  it('reaches an error state after a failed test send (a handled { success: false } result), and the button is usable again', async () => {
    sendTestMarketingEmailAction.mockResolvedValueOnce({ success: false, error: 'Bounced address.' })
    renderComposer()

    fireEvent.click(screen.getByRole('button', { name: 'Send Test to Myself' }))

    await waitFor(() => expect(screen.getByText('Bounced address.')).toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Send Test to Myself' })
    expect(button).toBeEnabled()

    sendTestMarketingEmailAction.mockResolvedValueOnce({ success: true, data: { messageId: 'msg-retry' } })
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('Test email sent — check the inbox.')).toBeInTheDocument())
  })

  it('never leaves the button stuck on "Sending…" when the request itself rejects (the production bug: an unhandled promise rejection, not a handled result)', async () => {
    sendTestMarketingEmailAction.mockRejectedValueOnce(new Error('Network connection lost.'))
    renderComposer()

    fireEvent.click(screen.getByRole('button', { name: 'Send Test to Myself' }))

    await waitFor(() => expect(screen.getByText('Network connection lost.')).toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Send Test to Myself' })
    expect(button).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Sending…' })).not.toBeInTheDocument()
  })
})
