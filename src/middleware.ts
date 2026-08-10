import { NextResponse, type NextRequest } from 'next/server'

import { isSitePasswordConfigured, SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'
import { toSafeInternalPath } from '@/lib/auth/safe-redirect'
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from '@/lib/training/auth/admin-session'

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/manifest.webmanifest',
  '/sw.js',
  '/icon.png',
  '/apple-icon.png',
  '/edugistics-logo.png',
  '/edugistics-logo-icon.png',
  // Reached from a link inside an email, at a root-level path (not
  // /training/*) — must stay reachable even if SITE_PASSWORD is
  // misconfigured, same as the landing page. The token is a query
  // parameter, not part of the pathname, so the exact path suffices.
  '/unsubscribe',
])
const PUBLIC_PREFIXES = ['/icons/', '/brand/', '/_next/']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// The training module is a separate public-facing product behind its own
// admin auth (ADMIN_SESSION_SECRET) — it must never be gated by the
// school-planning tool's shared SITE_PASSWORD.
const TRAINING_ADMIN_PUBLIC_PATHS = new Set([
  '/training/admin/login',
  '/api/training/admin/login',
  '/api/training/admin/logout',
])

function isTrainingPath(pathname: string): boolean {
  return pathname === '/training' || pathname.startsWith('/training/') || pathname.startsWith('/api/training/')
}

function isTrainingAdminPath(pathname: string): boolean {
  return (
    pathname === '/training/admin' ||
    pathname.startsWith('/training/admin/') ||
    pathname.startsWith('/api/training/admin/')
  )
}

async function trainingMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (!isTrainingAdminPath(pathname) || TRAINING_ADMIN_PUBLIC_PATHS.has(pathname)) {
    // Public /training pages, the admin login screen, and /api/training/*
    // registration endpoints — no gate.
    return NextResponse.next()
  }

  const adminSessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value
  const hasValidAdminSession = await verifyAdminSessionToken(adminSessionCookie)

  if (hasValidAdminSession) {
    const response = NextResponse.next()
    // Prevents bfcache from replaying an authenticated admin page after
    // sign-out without a fresh middleware check.
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Admin session required.' }, { status: 401 })
  }

  const loginUrl = new URL('/training/admin/login', request.url)
  const response = NextResponse.redirect(loginUrl)
  if (adminSessionCookie) {
    response.cookies.delete(ADMIN_SESSION_COOKIE_NAME)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isTrainingPath(pathname)) {
    return trainingMiddleware(request)
  }

  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const hasValidSession = await verifySessionToken(sessionCookie)

  if (isPublicPath(pathname)) {
    // The landing page and /login must stay reachable even if SITE_PASSWORD
    // is misconfigured — only the gated /app surface depends on it.
    if (pathname === '/login' && hasValidSession) {
      const target = toSafeInternalPath(request.nextUrl.searchParams.get('from')) ?? '/app/dashboard'
      return NextResponse.redirect(new URL(target, request.url))
    }
    return NextResponse.next()
  }

  if (!isSitePasswordConfigured()) {
    return new NextResponse('Server misconfiguration: SITE_PASSWORD is not set.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    })
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
