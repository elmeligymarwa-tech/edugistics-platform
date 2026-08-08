import { NextResponse, type NextRequest } from 'next/server'

import {
  createSessionToken,
  isSitePasswordConfigured,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifyPassword,
} from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  if (!isSitePasswordConfigured()) {
    return NextResponse.json({ error: 'Authentication is not configured on the server.' }, { status: 500 })
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

  const isValid = await verifyPassword(password)
  if (!isValid) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const token = await createSessionToken()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return response
}
