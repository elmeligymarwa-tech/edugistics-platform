import { NextResponse, type NextRequest } from 'next/server'

import { resubscribeByToken } from '@/lib/training/unsubscribe'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/training/rate-limit'

const UNSUBSCRIBE_RATE_LIMIT = 10
const UNSUBSCRIBE_RATE_WINDOW_MS = 60 * 60 * 1000

const INVALID_TOKEN_MESSAGE = 'This unsubscribe link is not valid.'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const token = typeof body === 'object' && body !== null && 'token' in body ? String((body as { token: unknown }).token) : ''
  if (!token) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 })
  }

  const ip = clientIpFromHeaders(request.headers)
  if (!checkRateLimit(`unsubscribe-resubscribe:${ip}`, UNSUBSCRIBE_RATE_LIMIT, UNSUBSCRIBE_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests from this connection. Please try again later.' }, { status: 429 })
  }

  const ok = await resubscribeByToken(token)
  if (!ok) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 404 })
  }

  return NextResponse.json({ data: { resubscribed: true } })
}
