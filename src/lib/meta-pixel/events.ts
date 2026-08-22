declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

function callFbq(...args: unknown[]): void {
  if (typeof window === 'undefined' || !window.fbq) return
  window.fbq(...args)
}

export function trackPageView(): void {
  callFbq('track', 'PageView')
}

/**
 * Course name only in custom_data — never the teacher's name, email, phone,
 * school, subject, grade or registration reference. Meta already matches
 * the browser to a profile via its own cookie; nothing submitted on the
 * form is handed over on top of that. `eventId` is the exception: it's
 * derived (reference + event name, see registerForCourse), not personal,
 * and is what lets Meta deduplicate this browser event against the
 * server-side Conversions API send of the exact same conversion — see
 * eventID in the fbq call below.
 */
export function trackCompleteRegistration(courseName: string, eventId: string): void {
  callFbq('track', 'CompleteRegistration', { course_name: courseName }, { eventID: eventId })
}

/**
 * A waitlist place isn't a registration — fired as its own custom event
 * (not a standard Meta event, hence `trackCustom`) so the two stay
 * distinguishable in Meta's reporting rather than both counting as
 * CompleteRegistration. Same eventId/eventID deduplication as
 * trackCompleteRegistration above.
 */
export function trackJoinedWaitlist(courseName: string, eventId: string): void {
  callFbq('trackCustom', 'JoinedWaitlist', { course_name: courseName }, { eventID: eventId })
}

const FIRED_STORAGE_PREFIX = 'meta-pixel-conversion:'

/**
 * sessionStorage-backed guard, keyed by registration reference, so a
 * conversion event fires exactly once per successful registration even if
 * the confirmation screen's component remounts within the same tab (a
 * refresh, or React re-mounting it) — an in-memory ref alone only survives
 * re-renders, not a remount.
 */
export function hasFiredConversionEvent(reference: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(FIRED_STORAGE_PREFIX + reference) === '1'
  } catch {
    return false
  }
}

export function markConversionEventFired(reference: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(FIRED_STORAGE_PREFIX + reference, '1')
  } catch {
    // Storage can throw under private-browsing restrictions — the caller's
    // own in-render guard still prevents a double-fire within the same mount.
  }
}
