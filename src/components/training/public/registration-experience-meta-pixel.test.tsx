// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

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

import type { PublicCourse } from '@/lib/training/public-courses'
import { RegistrationExperience } from './registration-experience'

function makeCourse(overrides: Partial<PublicCourse> = {}): PublicCourse {
  return {
    id: 'course-1',
    name: 'Leadership Essentials',
    shortDescription: 'x',
    category: 'LEADERSHIP',
    courseDate: new Date('2026-09-01T00:00:00.000Z'),
    sessions: [],
    isMultiDay: false,
    startTime: new Date('1970-01-01T09:00:00.000Z'),
    endTime: new Date('1970-01-01T10:00:00.000Z'),
    deliveryMethod: 'ONLINE',
    location: null,
    feeAmount: 0,
    currency: 'EGP',
    waitlistEnabled: false,
    isFull: false,
    ...overrides,
  }
}

async function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Amina Youssef' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'amina@example.com' } })
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0100000000' } })
  fireEvent.change(screen.getByLabelText('Current school or institution'), { target: { value: 'Nile School' } })
  fireEvent.change(screen.getByLabelText('Subject taught'), { target: { value: 'Maths' } })
  fireEvent.change(screen.getByLabelText('Grade or year group taught'), { target: { value: 'Year 6' } })
  fireEvent.click(screen.getByRole('button', { name: 'Register' }))
}

beforeEach(() => {
  window.sessionStorage.clear()
  trackCompleteRegistration.mockClear()
  trackJoinedWaitlist.mockClear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RegistrationExperience — Meta Pixel conversion event only fires on real success', () => {
  it('does not fire on a validation/field-error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Please fix the highlighted fields.', fieldErrors: { email: 'Invalid email' } }),
      }),
    )

    render(<RegistrationExperience courses={[makeCourse({ id: 'only' })]} />)
    await fillAndSubmit()

    await waitFor(() => expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument())
    expect(trackCompleteRegistration).not.toHaveBeenCalled()
    expect(trackJoinedWaitlist).not.toHaveBeenCalled()
  })

  it('does not fire on a duplicate-registration (409) response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'This email address is already registered for this course.' }),
      }),
    )

    render(<RegistrationExperience courses={[makeCourse({ id: 'only' })]} />)
    await fillAndSubmit()

    await waitFor(() =>
      expect(screen.getByText('This email address is already registered for this course.')).toBeInTheDocument(),
    )
    expect(trackCompleteRegistration).not.toHaveBeenCalled()
    expect(trackJoinedWaitlist).not.toHaveBeenCalled()
  })

  it('fires CompleteRegistration exactly once after a genuine successful confirmed registration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            status: 'CONFIRMED',
            reference: 'REG-INTEGRATION-1',
            teacherFullName: 'Amina Youssef',
            teacherEmail: 'amina@example.com',
            courseName: 'Leadership Essentials',
            courseDateLong: '1 September 2026',
            courseTimeRange: '9:00 – 10:00',
            promo: null,
          },
        }),
      }),
    )

    render(<RegistrationExperience courses={[makeCourse({ id: 'only' })]} />)
    await fillAndSubmit()

    await waitFor(() => expect(screen.getByText('Registration confirmed')).toBeInTheDocument())
    expect(trackCompleteRegistration).toHaveBeenCalledExactlyOnceWith('Leadership Essentials')
  })
})
