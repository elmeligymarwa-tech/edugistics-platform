import { cookies } from 'next/headers'

import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from './admin-session'

export class UnauthorizedAdminError extends Error {
  constructor() {
    super('Admin session required.')
    this.name = 'UnauthorizedAdminError'
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(ADMIN_SESSION_COOKIE_NAME)?.value
  return verifyAdminSessionToken(token)
}

/** Independent, server-side session check for every admin route and admin action — hiding a link is not protection. Throws UnauthorizedAdminError when the session is missing or invalid. */
export async function requireAdminSession(): Promise<void> {
  const ok = await isAdminAuthenticated()
  if (!ok) throw new UnauthorizedAdminError()
}
