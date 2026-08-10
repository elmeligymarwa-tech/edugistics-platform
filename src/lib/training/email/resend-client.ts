import 'server-only'

import { Resend } from 'resend'

export class MissingEmailConfigError extends Error {
  constructor(variable: string) {
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
