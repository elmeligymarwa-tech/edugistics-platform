// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const previewCampaignAction = vi.fn()
const getTemplateForSelectionAction = vi.fn()
vi.mock('@/app/training/admin/(protected)/registrations/email-actions', () => ({
  previewCampaignAction: (...args: unknown[]) => previewCampaignAction(...args),
  getTemplateForSelectionAction: (...args: unknown[]) => getTemplateForSelectionAction(...args),
}))

const sendCampaignAction = vi.fn()
const sendTestEmailAction = vi.fn()
vi.mock('@/app/training/admin/(protected)/registrations/send-actions', () => ({
  sendCampaignAction: (...args: unknown[]) => sendCampaignAction(...args),
  sendTestEmailAction: (...args: unknown[]) => sendTestEmailAction(...args),
}))

const { SendEmailComposer } = await import('./send-email-composer')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const criteria = { mode: 'ids' as const, registrationIds: ['reg-1', 'reg-2', 'reg-3'] }
const initialSummary = {
  rawRegistrationCount: 3,
  uniqueTeacherCount: 3,
  courses: [{ id: 'course-1', name: 'Course One' }],
  waitlistedRawCount: 0,
  singleCourseZoomLink: null,
}

function makePreview(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    uniqueTeacherCount: 3,
    rawRegistrationCount: 3,
    courses: [{ id: 'course-1', name: 'Course One' }],
    renderedBodyHtml: '<p>Body</p>',
    zoomLinkMissingCount: 0,
    example: { recipientName: 'Jane Teacher', subject: 'Hello Jane', html: '<p>Hi</p>', text: 'Hi' },
    ...overrides,
  }
}

async function goToPreview() {
  render(<SendEmailComposer open onOpenChange={() => {}} criteria={criteria} initialSummary={initialSummary} />)
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Subject line' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message body' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue to preview' }))
  await waitFor(() => expect(screen.getByText('Preview')).toBeInTheDocument())
}

describe('SendEmailComposer — preview step', () => {
  it('keeps Send disabled until the typed count exactly matches the confirmed recipient count', async () => {
    previewCampaignAction.mockResolvedValue({ success: true, data: makePreview() })
    await goToPreview()

    const sendButton = screen.getByRole('button', { name: /Send to 3 teachers/ })
    expect(sendButton).toBeDisabled()

    const confirmInput = screen.getByLabelText(/Type/)
    fireEvent.change(confirmInput, { target: { value: '2' } })
    expect(sendButton).toBeDisabled()

    fireEvent.change(confirmInput, { target: { value: '30' } })
    expect(sendButton).toBeDisabled()

    fireEvent.change(confirmInput, { target: { value: '3' } })
    expect(sendButton).toBeEnabled()
  })

  it('disables Send immediately on click so a second click cannot fire a second request', async () => {
    previewCampaignAction.mockResolvedValue({ success: true, data: makePreview() })
    await goToPreview()

    let resolveSend: (value: unknown) => void = () => {}
    sendCampaignAction.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve
      }),
    )

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: '3' } })
    const sendButton = screen.getByRole('button', { name: /Send to 3 teachers/ })
    expect(sendButton).toBeEnabled()

    fireEvent.click(sendButton)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled())
    expect(sendCampaignAction).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Sending…' }))
    expect(sendCampaignAction).toHaveBeenCalledTimes(1)

    resolveSend({ success: true, data: { campaignId: 'campaign-1' } })
  })
})

describe('SendEmailComposer — Send (main campaign send)', () => {
  it('reaches a settled, re-enabled state and navigates to the campaign after a successful send', async () => {
    previewCampaignAction.mockResolvedValue({ success: true, data: makePreview() })
    sendCampaignAction.mockResolvedValueOnce({ success: true, data: { campaignId: 'campaign-success' } })
    await goToPreview()

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /Send to 3 teachers/ }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Send to 3 teachers/ })).toBeEnabled())
  })

  it('reaches an error state after a failed send (a handled result), showing a clear error, and is usable again afterwards', async () => {
    previewCampaignAction.mockResolvedValue({ success: true, data: makePreview() })
    sendCampaignAction.mockResolvedValueOnce({ success: false, kind: 'validation', error: 'Something failed server-side.' })
    await goToPreview()

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /Send to 3 teachers/ }))

    await waitFor(() => expect(screen.getByText('Something failed server-side.')).toBeInTheDocument())
    const sendButton = screen.getByRole('button', { name: /Send to 3 teachers/ })
    expect(sendButton).toBeEnabled()

    sendCampaignAction.mockResolvedValueOnce({ success: true, data: { campaignId: 'campaign-retry' } })
    fireEvent.click(sendButton)
    await waitFor(() => expect(sendCampaignAction).toHaveBeenCalledTimes(2))
  })

  it('never leaves Send stuck on "Sending…" when the request itself rejects', async () => {
    previewCampaignAction.mockResolvedValue({ success: true, data: makePreview() })
    sendCampaignAction.mockRejectedValueOnce(new Error('Network connection lost.'))
    await goToPreview()

    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /Send to 3 teachers/ }))

    await waitFor(() => expect(screen.getByText('Network connection lost.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Send to 3 teachers/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Sending…' })).not.toBeInTheDocument()
  })
})

// "Send Test to Myself" lives on the compose step, so no preview round trip is needed to reach it.
function renderComposerAtCompose() {
  render(<SendEmailComposer open onOpenChange={() => {}} criteria={criteria} initialSummary={initialSummary} />)
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'admin@example.com' } })
}

describe('SendEmailComposer — Send Test to Myself', () => {
  it('reaches a success state after a successful test send, and the button is usable again', async () => {
    sendTestEmailAction.mockResolvedValueOnce({ success: true, data: { messageId: 'msg-1' } })
    renderComposerAtCompose()

    fireEvent.click(screen.getByRole('button', { name: 'Send Test to Myself' }))

    await waitFor(() => expect(screen.getByText('Test email sent — check the inbox.')).toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Send Test to Myself' })
    expect(button).toBeEnabled()

    // Usable again: a second click fires a second request rather than staying inert.
    sendTestEmailAction.mockResolvedValueOnce({ success: true, data: { messageId: 'msg-2' } })
    fireEvent.click(button)
    await waitFor(() => expect(sendTestEmailAction).toHaveBeenCalledTimes(2))
  })

  it('reaches an error state after a failed test send (a handled { success: false } result), and the button is usable again', async () => {
    sendTestEmailAction.mockResolvedValueOnce({ success: false, error: 'Bounced address.' })
    renderComposerAtCompose()

    fireEvent.click(screen.getByRole('button', { name: 'Send Test to Myself' }))

    await waitFor(() => expect(screen.getByText('Bounced address.')).toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Send Test to Myself' })
    expect(button).toBeEnabled()

    sendTestEmailAction.mockResolvedValueOnce({ success: true, data: { messageId: 'msg-retry' } })
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('Test email sent — check the inbox.')).toBeInTheDocument())
  })

  it('never leaves the button stuck on "Sending…" when the request itself rejects (the production bug: an unhandled promise rejection, not a handled result)', async () => {
    sendTestEmailAction.mockRejectedValueOnce(new Error('Network connection lost.'))
    renderComposerAtCompose()

    fireEvent.click(screen.getByRole('button', { name: 'Send Test to Myself' }))

    await waitFor(() => expect(screen.getByText('Network connection lost.')).toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Send Test to Myself' })
    expect(button).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Sending…' })).not.toBeInTheDocument()
  })
})
