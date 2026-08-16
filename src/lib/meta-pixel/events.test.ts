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
    expect(() => trackCompleteRegistration('Course A')).not.toThrow()
    expect(() => trackJoinedWaitlist('Course A')).not.toThrow()
  })

  it('trackPageView calls fbq("track", "PageView") with no extra data', () => {
    const fbq = vi.fn()
    window.fbq = fbq
    trackPageView()
    expect(fbq).toHaveBeenCalledExactlyOnceWith('track', 'PageView')
  })

  it('trackCompleteRegistration sends only the course name', () => {
    const fbq = vi.fn()
    window.fbq = fbq
    trackCompleteRegistration('Leadership Essentials')
    expect(fbq).toHaveBeenCalledExactlyOnceWith('track', 'CompleteRegistration', {
      course_name: 'Leadership Essentials',
    })
  })

  it('trackJoinedWaitlist fires as a distinct custom event with only the course name', () => {
    const fbq = vi.fn()
    window.fbq = fbq
    trackJoinedWaitlist('Leadership Essentials')
    expect(fbq).toHaveBeenCalledExactlyOnceWith('trackCustom', 'JoinedWaitlist', {
      course_name: 'Leadership Essentials',
    })
  })

  it('conversion-fired guard is false until marked, then true for that reference only', () => {
    expect(hasFiredConversionEvent('REG-1')).toBe(false)
    markConversionEventFired('REG-1')
    expect(hasFiredConversionEvent('REG-1')).toBe(true)
    expect(hasFiredConversionEvent('REG-2')).toBe(false)
  })
})
