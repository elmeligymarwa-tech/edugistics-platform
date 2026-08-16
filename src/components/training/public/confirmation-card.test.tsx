// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const { trackCompleteRegistration, trackJoinedWaitlist } = vi.hoisted(() => ({
  trackCompleteRegistration: vi.fn(),
  trackJoinedWaitlist: vi.fn(),
}))

vi.mock('@/lib/meta-pixel/events', async () => {
  const actual = await vi.importActual<typeof import('@/lib/meta-pixel/events')>('@/lib/meta-pixel/events')
  return {
    ...actual,
    trackCompleteRegistration,
    trackJoinedWaitlist,
  }
})

import { ConfirmationCard, type ConfirmedConfirmation, type WaitlistedConfirmation } from './confirmation-card'

const confirmed: ConfirmedConfirmation = {
  status: 'CONFIRMED',
  reference: 'REG-CONFIRMED-1',
  teacherFullName: 'Amina Youssef',
  teacherEmail: 'amina@example.com',
  courseName: 'Leadership Essentials',
  courseDateLong: '1 September 2026',
  courseTimeRange: '9:00 – 10:00',
  promo: null,
}

const waitlisted: WaitlistedConfirmation = {
  status: 'WAITLISTED',
  reference: 'REG-WAITLIST-1',
  teacherFullName: 'Amina Youssef',
  teacherEmail: 'amina@example.com',
  courseName: 'Leadership Essentials',
  waitlistPosition: 3,
  promo: null,
}

beforeEach(() => {
  window.sessionStorage.clear()
  trackCompleteRegistration.mockClear()
  trackJoinedWaitlist.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('ConfirmationCard — Meta Pixel conversion events', () => {
  it('fires CompleteRegistration once for a confirmed registration', () => {
    render(<ConfirmationCard confirmation={confirmed} onRegisterAnother={vi.fn()} />)
    expect(trackCompleteRegistration).toHaveBeenCalledExactlyOnceWith('Leadership Essentials')
    expect(trackJoinedWaitlist).not.toHaveBeenCalled()
  })

  it('fires JoinedWaitlist, not CompleteRegistration, for a waitlisted registration', () => {
    render(<ConfirmationCard confirmation={waitlisted} onRegisterAnother={vi.fn()} />)
    expect(trackJoinedWaitlist).toHaveBeenCalledExactlyOnceWith('Leadership Essentials')
    expect(trackCompleteRegistration).not.toHaveBeenCalled()
  })

  it('never passes anything but the course name — no name, email, phone, school or reference', () => {
    render(<ConfirmationCard confirmation={confirmed} onRegisterAnother={vi.fn()} />)
    // trackCompleteRegistration's own signature is (courseName: string) — there is no
    // parameter through which teacherFullName, teacherEmail or reference could travel.
    expect(trackCompleteRegistration.mock.calls[0]).toEqual(['Leadership Essentials'])
  })

  it('does not fire again when the confirmation screen remounts for the same reference (a refresh)', () => {
    const { unmount } = render(<ConfirmationCard confirmation={confirmed} onRegisterAnother={vi.fn()} />)
    unmount()

    render(<ConfirmationCard confirmation={confirmed} onRegisterAnother={vi.fn()} />)

    expect(trackCompleteRegistration).toHaveBeenCalledTimes(1)
  })

  it('fires independently for a different registration reference', () => {
    render(<ConfirmationCard confirmation={confirmed} onRegisterAnother={vi.fn()} />)
    render(<ConfirmationCard confirmation={{ ...confirmed, reference: 'REG-CONFIRMED-2' }} onRegisterAnother={vi.fn()} />)

    expect(trackCompleteRegistration).toHaveBeenCalledTimes(2)
  })
})
