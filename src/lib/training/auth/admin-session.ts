export const ADMIN_SESSION_COOKIE_NAME = 'edugistics_training_admin_session'
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

export class MissingAdminSessionSecretError extends Error {
  constructor() {
    super('ADMIN_SESSION_SECRET is not set on the server.')
    this.name = 'MissingAdminSessionSecretError'
  }
}

function getAdminSessionSecret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value) throw new MissingAdminSessionSecretError()
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

/** Creates a signed, expiring admin session token — independent of the site-wide SITE_PASSWORD session. Never contains the admin password or its hash. */
export async function createAdminSessionToken(): Promise<string> {
  const secret = getAdminSessionSecret()
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000
  const payload = String(expiresAt)
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payload}.${toBase64Url(signature)}`
}

/** Validates an admin session token's signature and expiry. Tampered or expired tokens fail. */
export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
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
    secret = getAdminSessionSecret()
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

export function isAdminSessionConfigured(): boolean {
  return Boolean(process.env.ADMIN_SESSION_SECRET)
}
