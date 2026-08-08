import { describe, expect, it } from 'vitest'

import { buildConfirmedEmail, buildPromotedEmail, buildWaitlistedEmail } from './templates'

const courseDetails = {
  courseName: 'Assessment for Learning',
  courseDateLong: 'Saturday, 14 March 2026',
  courseTimeRange: '09:00–12:00 (Cairo time)',
  deliveryMethodLabel: 'In person',
  location: 'Room 4, Cairo Campus',
  joiningInstructions: null,
  feeAmount: 0,
  currency: 'EGP',
  reference: 'EDU-2026-AB12CD',
}

describe('buildConfirmedEmail', () => {
  it('states the course is free of charge when feeAmount is zero', () => {
    const email = buildConfirmedEmail({ teacherName: 'Jane Doe', ...courseDetails })
    expect(email.html).toContain('Free of charge')
    expect(email.text).toContain('Free of charge')
    expect(email.html).not.toContain('Payment is not collected')
  })

  it('states payment is not collected through the system when the course has a fee', () => {
    const email = buildConfirmedEmail({ teacherName: 'Jane Doe', ...courseDetails, feeAmount: 500 })
    expect(email.html).toContain('EGP 500')
    expect(email.html).toContain('Payment is not collected through the registration system')
    expect(email.text).toContain('Payment is not collected through the registration system')
  })

  it('includes the reference and course name in both html and text', () => {
    const email = buildConfirmedEmail({ teacherName: 'Jane Doe', ...courseDetails })
    expect(email.html).toContain('EDU-2026-AB12CD')
    expect(email.text).toContain('EDU-2026-AB12CD')
    expect(email.text).toContain('Assessment for Learning')
  })

  it('escapes html-significant characters in user-supplied names', () => {
    const email = buildConfirmedEmail({ teacherName: 'Jane <script>alert(1)</script>', ...courseDetails })
    expect(email.html).not.toContain('<script>')
  })
})

describe('buildWaitlistedEmail', () => {
  it('states the position and that no place is confirmed yet, without joining instructions', () => {
    const email = buildWaitlistedEmail({
      teacherName: 'Jane Doe',
      courseName: 'Assessment for Learning',
      waitlistPosition: 3,
      reference: 'EDU-2026-ZZ99YY',
    })
    expect(email.html).toContain('number <strong>3</strong>')
    expect(email.text).toContain('number 3')
    expect(email.html.toLowerCase()).toContain('do not yet have a confirmed place')
    expect(email.html).not.toContain('Joining instructions')
  })
})

describe('buildPromotedEmail', () => {
  it('confirms the seat and includes joining instructions when present', () => {
    const email = buildPromotedEmail({
      teacherName: 'Jane Doe',
      ...courseDetails,
      joiningInstructions: 'Enter via the main gate.',
    })
    expect(email.html).toContain('now confirmed')
    expect(email.html).toContain('Enter via the main gate.')
  })
})
