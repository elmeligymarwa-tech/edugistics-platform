import 'server-only'

import { Resend } from 'resend'

export class MissingEmailConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`${variable} is not set on the server.`)
    this.name = 'MissingEmailConfigError'
  }
}

let client: Resend | undefined

/** Lazily constructed so a missing RESEND_API_KEY only fails when an email actually needs sending, not at import time. */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new MissingEmailConfigError('RESEND_API_KEY')
  if (!client) client = new Resend(apiKey)
  return client
}

export function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM
  if (!from) throw new MissingEmailConfigError('EMAIL_FROM')
  return from
}

export function getEmailReplyTo(): string {
  const replyTo = process.env.EMAIL_REPLY_TO
  if (!replyTo) throw new MissingEmailConfigError('EMAIL_REPLY_TO')
  return replyTo
}

/**
 * Marketing email (the composer, Phase D's sending engine) sends from a
 * separate domain — news.edugistics.online — never from EMAIL_FROM's
 * transactional domain. Keeping bulk marketing traffic off the domain that
 * sends registration/course confirmations protects that domain's sender
 * reputation if a marketing send is ever reported as spam.
 */
export function getMarketingEmailFrom(): string {
  const from = process.env.MARKETING_EMAIL_FROM
  if (!from) throw new MissingEmailConfigError('MARKETING_EMAIL_FROM')
  return from
}

/**
 * Every variable a bulk (registrations) send needs, in the order they
 * should be reported missing. RESEND_API_KEY first since without it nothing
 * else matters.
 */
const BULK_EMAIL_REQUIRED_VARS = ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO'] as const

/** Marketing sends never use EMAIL_FROM/EMAIL_REPLY_TO — MARKETING_EMAIL_FROM is deliberately a separate domain (see getMarketingEmailFrom). */
const MARKETING_EMAIL_REQUIRED_VARS = ['RESEND_API_KEY', 'MARKETING_EMAIL_FROM'] as const

function firstMissing(vars: readonly string[]): string | null {
  return vars.find((name) => !process.env[name]) ?? null
}

/**
 * Reads process.env directly rather than calling the getters above and
 * catching MissingEmailConfigError — this runs as a pre-flight check before
 * a campaign is created (see send-actions.ts), where the point is to fail
 * before any row is written, not to exercise the same code path sending
 * itself will use.
 */
export function validateBulkEmailConfig(): string | null {
  return firstMissing(BULK_EMAIL_REQUIRED_VARS)
}

export function validateMarketingEmailConfig(): string | null {
  return firstMissing(MARKETING_EMAIL_REQUIRED_VARS)
}

/** Every required variable currently missing, across both send paths — used by the startup check (see instrumentation.ts) to warn about all of them at once, not just the first. */
export function findMissingEmailConfigVars(): string[] {
  const allVars = [...new Set([...BULK_EMAIL_REQUIRED_VARS, ...MARKETING_EMAIL_REQUIRED_VARS])]
  return allVars.filter((name) => !process.env[name])
}
