export const SESSION_COOKIE_NAME = 'edugistics_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export class MissingSitePasswordError extends Error {
  constructor() {
    super('SITE_PASSWORD is not set on the server.')
    this.name = 'MissingSitePasswordError'
  }
}

function getSitePassword(): string {
  const value = process.env.SITE_PASSWORD
  if (!value) throw new MissingSitePasswordError()
  return value
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Creates a signed, expiring session token. Never contains the site password itself. */
export async function createSessionToken(): Promise<string> {
  const secret = getSitePassword()
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const payload = String(expiresAt)
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payload}.${toBase64Url(signature)}`
}

/** Validates a session token's signature and expiry. Tampered or expired tokens fail. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false

  const separatorIndex = token.indexOf('.')
  if (separatorIndex <= 0) return false

  const payload = token.slice(0, separatorIndex)
  const signaturePart = token.slice(separatorIndex + 1)
  if (!signaturePart) return false

  const expiresAt = Number(payload)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  let secret: string
  try {
    secret = getSitePassword()
  } catch {
    return false
  }

  let signature: Uint8Array<ArrayBuffer>
  try {
    signature = fromBase64Url(signaturePart)
  } catch {
    return false
  }

  const key = await importHmacKey(secret)
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(payload))
}

/** Constant-time password comparison — never short-circuits on length or content. */
export async function verifyPassword(candidate: string): Promise<boolean> {
  const expected = getSitePassword()
  const encoder = new TextEncoder()
  const [candidateDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])

  const a = new Uint8Array(candidateDigest)
  const b = new Uint8Array(expectedDigest)
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

export function isSitePasswordConfigured(): boolean {
  return Boolean(process.env.SITE_PASSWORD)
}
