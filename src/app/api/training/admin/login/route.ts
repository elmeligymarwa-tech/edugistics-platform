import { NextResponse, type NextRequest } from 'next/server'

import { isAdminPasswordConfigured, verifyAdminPassword } from '@/lib/training/auth/admin-password'
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  isAdminSessionConfigured,
} from '@/lib/training/auth/admin-session'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/training/rate-limit'

const LOGIN_RATE_LIMIT = 5
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  if (!isAdminPasswordConfigured() || !isAdminSessionConfigured()) {
    return NextResponse.json({ error: 'Admin authentication is not configured on the server.' }, { status: 500 })
  }

  const ip = clientIpFromHeaders(request.headers)
  if (!checkRateLimit(`training-admin-login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  let password: unknown
  try {
    const body = await request.json()
    password = (body as { password?: unknown })?.password
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const isValid = await verifyAdminPassword(password)
  if (!isValid) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const token = await createAdminSessionToken()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  })
  return response
}
