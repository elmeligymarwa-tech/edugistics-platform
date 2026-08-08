import { NextResponse } from 'next/server'

import { ADMIN_SESSION_COOKIE_NAME } from '@/lib/training/auth/admin-session'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME)
  return response
}
