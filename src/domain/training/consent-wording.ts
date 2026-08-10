/**
 * The single source of truth for every piece of marketing consent wording
 * across the site. Every Subscriber/ConsentEvent row records the version in
 * force at the moment consent was given, so historical records always keep
 * the wording the person actually saw — change a text here and bump its
 * version together; never edit the text under an existing version.
 *
 * v1 is the registration form's marketing consent checkbox. v2 is the
 * landing page subscribe form — a separate form with its own wording, not a
 * successor to v1; both stay "current" for their own form at once.
 */
export const CURRENT_CONSENT_WORDING_VERSION = 'v1'
export const LANDING_PAGE_CONSENT_WORDING_VERSION = 'v2'

export const CONSENT_WORDING_BY_VERSION: Record<string, string> = {
  v1: 'Yes, I would like to receive emails from Edugistics about future training, webinars, educational resources and professional development opportunities.',
  v2: 'By subscribing you agree to receive emails from Edugistics about future training, webinars, educational resources and professional development opportunities. You can unsubscribe at any time.',
}

export const CURRENT_CONSENT_WORDING = CONSENT_WORDING_BY_VERSION[CURRENT_CONSENT_WORDING_VERSION]!
export const LANDING_PAGE_CONSENT_WORDING = CONSENT_WORDING_BY_VERSION[LANDING_PAGE_CONSENT_WORDING_VERSION]!

/** consentWordingVersion recorded for Subscriber rows created by the one-off legacy-consent migration script — the exact wording those teachers saw at the time isn't known. */
export const MIGRATED_CONSENT_WORDING_VERSION = 'v0-migrated'

