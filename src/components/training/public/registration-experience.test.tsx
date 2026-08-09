// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import type { PublicCourse } from '@/lib/training/public-courses'
import { RegistrationExperience } from './registration-experience'

afterEach(() => {
  cleanup()
})

function makeCourse(overrides: Partial<PublicCourse> = {}): PublicCourse {
  return {
    id: 'course-1',
    name: 'Sample Course',
    shortDescription: 'x',
    category: 'LEADERSHIP',
    courseDate: new Date('2026-09-01T00:00:00.000Z'),
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

describe('RegistrationExperience — step 1 / step 2 flow', () => {
  it('shows step 2 disabled with a hint until a course is selected', () => {
    render(
      <RegistrationExperience
        courses={[makeCourse({ id: 'a', name: 'Course A' }), makeCourse({ id: 'b', name: 'Course B' })]}
      />,
    )

    expect(screen.getByText('Step 1. Choose your course')).toBeInTheDocument()
    expect(screen.getByText('Step 2. Your details')).toBeInTheDocument()
    expect(screen.getByText('Select a course above to continue.')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()
  })

  it('selecting a course collapses step 1 into a summary panel and activates step 2', () => {
    render(
      <RegistrationExperience
        courses={[makeCourse({ id: 'a', name: 'Course A' }), makeCourse({ id: 'b', name: 'Course B' })]}
      />,
    )

    fireEvent.click(screen.getByText('Course A'))

    expect(screen.queryByText('Select a course above to continue.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled()
    expect(screen.getByText('Change course')).toBeInTheDocument()
    // The other card is gone from view — step 1 shows only the chosen course now.
    expect(screen.queryByText('Course B')).not.toBeInTheDocument()
  })

  it('"Change course" returns to the card grid', () => {
    render(
      <RegistrationExperience
        courses={[makeCourse({ id: 'a', name: 'Course A' }), makeCourse({ id: 'b', name: 'Course B' })]}
      />,
    )

    fireEvent.click(screen.getByText('Course A'))
    fireEvent.click(screen.getByText('Change course'))

    expect(screen.getByText('Select a course above to continue.')).toBeInTheDocument()
    expect(screen.getByText('Course B')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeDisabled()
  })

  it('auto-preselects a single open, selectable course and lands straight on step 2', () => {
    render(<RegistrationExperience courses={[makeCourse({ id: 'only', name: 'Only Course' })]} />)

    expect(screen.queryByText('Select a course above to continue.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeEnabled()
    expect(screen.getByText('Only Course')).toBeInTheDocument()
    // Nothing else to change to, so the link is omitted rather than pointing at an empty grid.
    expect(screen.queryByText('Change course')).not.toBeInTheDocument()
  })

  it('does not auto-select a single course that is full with no waitlist', () => {
    render(
      <RegistrationExperience
        courses={[makeCourse({ id: 'only', name: 'Full Course', isFull: true, waitlistEnabled: false })]}
      />,
    )

    expect(screen.getByText('Select a course above to continue.')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeDisabled()
  })

  it('still auto-selects a single full course when its waitlist is open', () => {
    render(
      <RegistrationExperience
        courses={[makeCourse({ id: 'only', name: 'Waitlist Course', isFull: true, waitlistEnabled: true })]}
      />,
    )

    expect(screen.queryByText('Select a course above to continue.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeEnabled()
  })
})

describe('RegistrationExperience — promo code field', () => {
  it('is hidden for a free course', () => {
    render(<RegistrationExperience courses={[makeCourse({ id: 'only', name: 'Free Course', feeAmount: 0 })]} />)

    expect(screen.queryByLabelText('Promo code (optional)')).not.toBeInTheDocument()
    expect(screen.queryByText(/Promo code/)).not.toBeInTheDocument()
  })

  it('is shown for a course with a fee above zero', () => {
    render(<RegistrationExperience courses={[makeCourse({ id: 'only', name: 'Paid Course', feeAmount: 2000 })]} />)

    expect(screen.getByLabelText('Promo code (optional)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
    expect(screen.getByText('Course fee: EGP 2,000')).toBeInTheDocument()
  })

  it('disables Apply until a code is typed', () => {
    render(<RegistrationExperience courses={[makeCourse({ id: 'only', name: 'Paid Course', feeAmount: 2000 })]} />)

    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Promo code (optional)'), { target: { value: 'EDU20' } })
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
  })

  it('hides the field again after switching to a free course', () => {
    render(
      <RegistrationExperience
        courses={[
          makeCourse({ id: 'paid', name: 'Paid Course', feeAmount: 2000 }),
          makeCourse({ id: 'free', name: 'Free Course', feeAmount: 0 }),
        ]}
      />,
    )

    fireEvent.click(screen.getByText('Paid Course'))
    expect(screen.getByLabelText('Promo code (optional)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Change course'))
    fireEvent.click(screen.getByText('Free Course'))
    expect(screen.queryByLabelText('Promo code (optional)')).not.toBeInTheDocument()
  })
})
