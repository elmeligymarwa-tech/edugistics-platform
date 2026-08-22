import 'server-only'

import { resolveDatabaseEnvironment, type DatabaseEnvironment } from '@/lib/training/database-environment'

// Same numeric id as NEXT_PUBLIC_META_PIXEL_ID (src/lib/meta-pixel/config.ts)
// — a dataset and its browser Pixel share one id. Hardcoded per the build
// spec rather than read from that env var: this is a distinct, server-side
// concern, and CAPI's own config should not depend on the client pixel
// happening to stay configured.
const CAPI_DATASET_ID = '2040486313339822'
const CAPI_GRAPH_VERSION = 'v21.0'

export type ConversionEventName = 'CompleteRegistration' | 'JoinedWaitlist'

export interface ConversionEventInput {
  eventName: ConversionEventName
  eventId: string
  /**
   * "website" — the browser-originated flow (public registration), where a
   * shared event_id deduplicates against the Meta Pixel's own send.
   * "system_generated" — an admin action with no browser counterpart (e.g.
   * waitlist promotion): no deduplication partner exists, so event_id only
   * has to guard against this event being sent twice, not against
   * colliding with a pixel event.
   */
  actionSource: 'website' | 'system_generated'
  /** Required by Meta only when actionSource is "website" — omitted from the payload otherwise. */
  eventSourceUrl?: string
  courseName: string
  /** Omitted from user_data entirely when neither is provided — there is no browser session to describe for a "system_generated" event. */
  clientIpAddress?: string
  clientUserAgent?: string
}

export type SendMode =
  | { kind: 'disabled-no-token' }
  | { kind: 'disabled-no-test-code'; environment: Exclude<DatabaseEnvironment, 'PRODUCTION'> }
  | { kind: 'live' }
  | { kind: 'test'; testEventCode: string }

/**
 * Mandatory environment gating (see TEST-DATABASE.md and
 * src/lib/training/database-environment.ts): a local dev or unrecognised
 * database must never be able to send a live conversion, even if
 * META_CAPI_ACCESS_TOKEN happens to be set (e.g. copied into
 * .env.development.local along with everything else). PRODUCTION is the
 * only ref allowed to send without a test_event_code; anything else either
 * sends clearly marked as a test event, or does not send at all. Never
 * derived from NODE_ENV — see database-environment.ts for why.
 */
export function resolveSendMode(): SendMode {
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!token) return { kind: 'disabled-no-token' }

  const environment = resolveDatabaseEnvironment(process.env.DATABASE_URL)
  if (environment === 'PRODUCTION') return { kind: 'live' }

  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE
  if (!testEventCode) return { kind: 'disabled-no-test-code', environment }
  return { kind: 'test', testEventCode }
}

// Logged once per process (not once per event) so a long-lived Fluid Compute
// instance doesn't spam the same line on every registration — the mode
// can't change mid-process, since it's derived from env vars fixed at
// startup.
let loggedMode = false

function logModeOnce(mode: SendMode): void {
  if (loggedMode) return
  loggedMode = true

  switch (mode.kind) {
    case 'disabled-no-token':
      console.log('[meta-capi] disabled: META_CAPI_ACCESS_TOKEN is not set. No conversion events will be sent.')
      return
    case 'disabled-no-test-code':
      console.log(
        `[meta-capi] disabled: DATABASE_URL resolved to ${mode.environment}, not production, and META_CAPI_TEST_EVENT_CODE is not set. No conversion events will be sent.`,
      )
      return
    case 'live':
      console.log('[meta-capi] live: DATABASE_URL resolved to production. Sending real conversion events, no test_event_code.')
      return
    case 'test':
      console.log('[meta-capi] test: DATABASE_URL is not production. Sending conversion events tagged with test_event_code.')
      return
  }
}

/**
 * Sends one Conversions API event to Meta. Never throws: a failure here
 * must never be a user-facing error or block a registration (see the
 * caller, which invokes this after the response has already been sent).
 * Deliberately no personal data in the payload beyond client_ip_address and
 * client_user_agent — see the build spec's DECIDED SCOPE.
 */
export async function sendConversionEvent(input: ConversionEventInput): Promise<void> {
  const mode = resolveSendMode()
  logModeOnce(mode)

  if (mode.kind === 'disabled-no-token' || mode.kind === 'disabled-no-test-code') return

  const userData: Record<string, string> = {}
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: input.actionSource,
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        custom_data: { course_name: input.courseName },
        ...(Object.keys(userData).length > 0 ? { user_data: userData } : {}),
      },
    ],
    ...(mode.kind === 'test' ? { test_event_code: mode.testEventCode } : {}),
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${CAPI_GRAPH_VERSION}/${CAPI_DATASET_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN!)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    if (response.ok) {
      console.log(`[meta-capi] sent: event=${input.eventName} event_id=${input.eventId} mode=${mode.kind} status=${response.status}`)
    } else {
      const body = await response.text().catch(() => '(could not read response body)')
      console.error(
        `[meta-capi] send failed: event=${input.eventName} event_id=${input.eventId} mode=${mode.kind} status=${response.status} — ${body}`,
      )
    }
  } catch (error) {
    console.error(
      `[meta-capi] send threw: event=${input.eventName} event_id=${input.eventId} mode=${mode.kind} — ${error instanceof Error ? error.message : error}`,
    )
  }
}
