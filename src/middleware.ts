import { NextResponse, type NextRequest } from 'next/server'

import { isSitePasswordConfigured, SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'
import { toSafeInternalPath } from '@/lib/auth/safe-redirect'

const PUBLIC_PATHS = new Set([
  '/login',
  '/manifest.webmanifest',
  '/sw.js',
  '/icon.png',
  '/apple-icon.png',
  '/edugistics-logo.png',
  '/edugistics-logo-icon.png',
])
const PUBLIC_PREFIXES = ['/icons/', '/brand/', '/_next/']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  if (!isSitePasswordConfigured()) {
    return new NextResponse('Server misconfiguration: SITE_PASSWORD is not set.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    })
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const hasValidSession = await verifySessionToken(sessionCookie)

  if (isPublicPath(pathname)) {
    if (pathname === '/login' && hasValidSession) {
      const target = toSafeInternalPath(request.nextUrl.searchParams.get('from')) ?? '/dashboard'
      return NextResponse.redirect(new URL(target, request.url))
    }
    return NextResponse.next()
  }

  if (hasValidSession) {
    const response = NextResponse.next()
    // Prevents the browser back/forward cache from replaying an authenticated
    // page after sign-out without a fresh middleware check.
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', `${pathname}${search}`)
  const response = NextResponse.redirect(loginUrl)
  if (sessionCookie) {
    response.cookies.delete(SESSION_COOKIE_NAME)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
