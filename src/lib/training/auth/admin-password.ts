import 'server-only'

import { verify } from '@node-rs/argon2'

export class MissingAdminPasswordHashError extends Error {
  constructor() {
    super('ADMIN_PASSWORD_HASH is not set on the server.')
    this.name = 'MissingAdminPasswordHashError'
  }
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD_HASH)
}

/** Verifies a candidate password against ADMIN_PASSWORD_HASH using argon2id. Never logs the candidate. */
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH
  if (!hash) throw new MissingAdminPasswordHashError()
  return verify(hash, candidate)
}
