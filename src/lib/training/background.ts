import 'server-only'

import { after } from 'next/server'

/**
 * Runs work after the response has been sent, so a bulk send doesn't hold
 * the admin's request open while hundreds of emails go out. Falls back to
 * fire-and-forget when called outside a Next.js request scope — `after()`
 * throws synchronously in that case (e.g. a script, or a test calling the
 * action function directly rather than through the Next request pipeline).
 */
export function runAfterResponse(work: () => Promise<void>): void {
  try {
    after(work)
  } catch {
    void work()
  }
}
