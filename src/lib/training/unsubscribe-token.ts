import { randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32

/**
 * A cryptographically random, URL-safe token for Subscriber.unsubscribeToken.
 * Deliberately not derived from the email address, teacher id or any
 * sequential value — holding a token must only ever unsubscribe the one
 * matching row, and must give no way to guess another.
 */
export function generateUnsubscribeToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}
