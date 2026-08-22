// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  hasFiredConversionEvent,
  markConversionEventFired,
  trackCompleteRegistration,
  trackJoinedWaitlist,
  trackPageView,
} from './events'

describe('meta pixel events', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    delete window.fbq
  })

  it('does not throw and does nothing when window.fbq is not present', () => {
    delete window.fbq
    expect(() => trackPageView()).not.toThrow()
    expect(() => trackCompleteRegistration('Course A', 'REG-1:CompleteRegistration')).not.toThrow()
    expect(() => trackJoinedWaitlist('Course A', 'REG-1:JoinedWaitlist')).not.toThrow()
  })

  it('trackPageView calls fbq("track", "PageView") with no extra data', () => {
    const fbq = vi.fn()
    window.fbq = fbq
    trackPageView()
    expect(fbq).toHaveBeenCalledExactlyOnceWith('track', 'PageView')
  })

  it('trackCompleteRegistration sends only the course name, with the event id as the fbq eventID option', () => {
    const fbq = vi.fn()
    window.fbq = fbq
    trackCompleteRegistration('Leadership Essentials', 'REG-1:CompleteRegistration')
    expect(fbq).toHaveBeenCalledExactlyOnceWith(
      'track',
      'CompleteRegistration',
      { course_name: 'Leadership Essentials' },
      { eventID: 'REG-1:CompleteRegistration' },
    )
  })

  it('trackJoinedWaitlist fires as a distinct custom event with only the course name, with the event id as the fbq eventID option', () => {
    const fbq = vi.fn()
    window.fbq = fbq
    trackJoinedWaitlist('Leadership Essentials', 'REG-1:JoinedWaitlist')
    expect(fbq).toHaveBeenCalledExactlyOnceWith(
      'trackCustom',
      'JoinedWaitlist',
      { course_name: 'Leadership Essentials' },
      { eventID: 'REG-1:JoinedWaitlist' },
    )
  })

  it('conversion-fired guard is false until marked, then true for that reference only', () => {
    expect(hasFiredConversionEvent('REG-1')).toBe(false)
    markConversionEventFired('REG-1')
    expect(hasFiredConversionEvent('REG-1')).toBe(true)
    expect(hasFiredConversionEvent('REG-2')).toBe(false)
  })
})
