import { findMissingEmailConfigVars } from '@/lib/training/email/resend-client'

/**
 * Runs once per server instance at cold start (Next.js instrumentation hook
 * — see https://nextjs.org/docs/app/guides/instrumentation). A misconfigured
 * email variable used to only surface when a campaign silently failed to
 * send (see send-marketing-campaign.ts/send-campaign.ts) — logging it here
 * puts it in the deployment logs immediately instead.
 */
export async function register(): Promise<void> {
  const missing = findMissingEmailConfigVars()
  if (missing.length > 0) {
    console.warn(
      `[startup] Missing required email environment variable(s): ${missing.join(', ')}. Campaign sending will be refused until these are set.`,
    )
  }
}
