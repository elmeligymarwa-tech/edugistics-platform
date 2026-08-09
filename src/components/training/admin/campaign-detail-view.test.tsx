// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const retryFailedRecipientsAction = vi.fn()
vi.mock('@/app/training/admin/(protected)/registrations/send-actions', () => ({
  retryFailedRecipientsAction: (...args: unknown[]) => retryFailedRecipientsAction(...args),
}))

const { CampaignDetailView } = await import('./campaign-detail-view')
import type { CampaignDetailData } from '@/lib/training/email/campaign-analytics'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function makeDetail(overrides: Partial<CampaignDetailData> = {}): CampaignDetailData {
  return {
    id: 'campaign-1',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    courseId: 'course-1',
    courseName: 'Sample Course',
    subject: 'Sample subject',
    bodyTemplate: 'Body',
    renderedBodyHtml: '<p>Body</p>',
    emailType: 'CUSTOM',
    recipientCount: 2,
    sentCount: 1,
    failedCount: 1,
    successRate: 50,
    recipients: [
      { id: 'r1', teacherName: 'Teacher Sent', emailAddress: 'sent@test.local', status: 'SENT', sentAt: new Date(), errorMessage: null },
      { id: 'r2', teacherName: 'Teacher Failed', emailAddress: 'failed@test.local', status: 'FAILED', sentAt: null, errorMessage: 'Bounced' },
    ],
    ...overrides,
  }
}

describe('CampaignDetailView', () => {
  it('shows every recipient by default (status filter starts on "All statuses")', () => {
    render(<CampaignDetailView detail={makeDetail()} />)
    expect(screen.getByText('Teacher Sent')).toBeInTheDocument()
    expect(screen.getByText('Teacher Failed')).toBeInTheDocument()
    expect(screen.getByText('Bounced')).toBeInTheDocument()
  })

  it('disables Retry Failed when there are no failures', () => {
    render(<CampaignDetailView detail={makeDetail({ failedCount: 0, sentCount: 2, recipients: [makeDetail().recipients[0]!] })} />)
    expect(screen.getByRole('button', { name: 'Retry Failed' })).toBeDisabled()
  })

  it('calls retryFailedRecipientsAction with this campaign\'s id when Retry Failed is clicked', async () => {
    retryFailedRecipientsAction.mockResolvedValue({ success: true, data: { retriedCount: 1 } })
    render(<CampaignDetailView detail={makeDetail()} />)

    const retryButton = screen.getByRole('button', { name: 'Retry Failed' })
    expect(retryButton).toBeEnabled()
    fireEvent.click(retryButton)

    expect(retryFailedRecipientsAction).toHaveBeenCalledWith('campaign-1')
  })
})
