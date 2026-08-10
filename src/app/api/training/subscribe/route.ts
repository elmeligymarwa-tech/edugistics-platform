import { NextResponse, type NextRequest } from 'next/server'

import { landingSubscribeSchema } from '@/domain/training/landing-subscribe-schema'
import { subscribeFromLandingPage } from '@/lib/training/landing-subscribe'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/training/rate-limit'

const SUBSCRIBE_RATE_LIMIT = 3
const SUBSCRIBE_RATE_WINDOW_MS = 60 * 60 * 1000

const SUCCESS_RESPONSE = { data: { subscribed: true } }

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // 1. Validate name and email format.
  const parsed = landingSubscribeSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Please fix the highlighted fields.', fieldErrors }, { status: 400 })
  }

  // 2. Honeypot — real visitors never populate this hidden field. Drop
  // silently: no database write, no rate-limit consumption, and the exact
  // same success response a real subscriber gets, so a bot learns nothing.
  if (parsed.data.website) {
    return NextResponse.json(SUCCESS_RESPONSE)
  }

  // 3. Rate limit by IP.
  const ip = clientIpFromHeaders(request.headers)
  if (!checkRateLimit(`landing-subscribe:${ip}`, SUBSCRIBE_RATE_LIMIT, SUBSCRIBE_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many submissions from this connection. Please try again later.' }, { status: 429 })
  }

  // 4-5. Normalise and resolve the subscriber — subscribeFromLandingPage
  // handles all three outcomes (new, already subscribed, resubscribe)
  // identically from the caller's point of view.
  await subscribeFromLandingPage({ fullName: parsed.data.fullName, email: parsed.data.email, now: new Date() })

  // 6. Identical response in every resolution case — never discloses
  // whether the address was already on the list.
  return NextResponse.json(SUCCESS_RESPONSE)
}
