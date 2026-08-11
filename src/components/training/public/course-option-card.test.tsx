// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'

import { formatCourseDateLong } from '@/domain/training/format'
import type { PublicCourse } from '@/lib/training/public-courses'
import { CourseOptionCard } from './course-option-card'

afterEach(() => cleanup())

function makeCourse(overrides: Partial<PublicCourse> = {}): PublicCourse {
  return {
    id: 'course-1',
    name: 'Test Course',
    shortDescription: 'x',
    category: 'LEADERSHIP',
    courseDate: new Date('2026-08-10T00:00:00.000Z'),
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

describe('CourseOptionCard', () => {
  it('shows a single, plain date for a single-day course — unaffected by multi-day support', () => {
    const course = makeCourse()
    render(<CourseOptionCard course={course} selected={false} onSelect={() => {}} />)
    expect(screen.getByText(formatCourseDateLong(course.courseDate))).toBeInTheDocument()
    expect(screen.queryByText(/to.*2026/)).not.toBeInTheDocument()
  })

  it('shows the session dates and count for a multi-day course', () => {
    const sessionDates = [new Date('2026-09-05T00:00:00.000Z'), new Date('2026-09-19T00:00:00.000Z')]
    const course = makeCourse({
      isMultiDay: true,
      courseDate: sessionDates[0]!,
      sessions: sessionDates,
    })
    render(<CourseOptionCard course={course} selected={false} onSelect={() => {}} />)
    expect(screen.getByText('5 and 19 September 2026, 2 sessions')).toBeInTheDocument()
  })
})
