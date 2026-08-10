/**
 * The single source of truth for the marketing consent checkbox wording
 * shown on the public registration form. Every Subscriber/ConsentEvent row
 * records CURRENT_CONSENT_WORDING_VERSION at the moment consent was given,
 * so historical records always keep the version the teacher actually saw —
 * change the text here and bump the version together; never edit the text
 * under an existing version.
 */
export const CURRENT_CONSENT_WORDING_VERSION = 'v1'

export const CONSENT_WORDING_BY_VERSION: Record<string, string> = {
  v1: 'Yes, I would like to receive emails from Edugistics about future training, webinars, educational resources and professional development opportunities.',
}

export const CURRENT_CONSENT_WORDING = CONSENT_WORDING_BY_VERSION[CURRENT_CONSENT_WORDING_VERSION]!

/** consentWordingVersion recorded for Subscriber rows created by the one-off legacy-consent migration script — the exact wording those teachers saw at the time isn't known. */
export const MIGRATED_CONSENT_WORDING_VERSION = 'v0-migrated'

