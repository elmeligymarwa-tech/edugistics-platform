import 'server-only'

import { getEmailFrom, getEmailReplyTo, getResendClient } from './resend-client'
import { buildConfirmedEmail, buildPromotedEmail, buildWaitlistedEmail, type CourseEmailDetails } from './templates'

export class EmailSendError extends Error {
  constructor(cause: string) {
    super(`Failed to send email: ${cause}`)
    this.name = 'EmailSendError'
  }
}

/** Resend's message id, recorded for delivery auditing. Throws EmailSendError on any failure — the caller records emailStatus FAILED and keeps the registration. */
async function dispatch(to: string, content: { subject: string; html: string; text: string }): Promise<string> {
  const resend = getResendClient()
  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to,
    replyTo: getEmailReplyTo(),
    subject: content.subject,
    html: content.html,
    text: content.text,
  })

  if (error || !data) {
    throw new EmailSendError(error?.message ?? 'Unknown error')
  }

  console.info(`[training] Resend accepted email ${data.id} for ${to}`)
  return data.id
}

export async function sendConfirmedEmail(to: string, params: { teacherName: string } & CourseEmailDetails): Promise<string> {
  return dispatch(to, buildConfirmedEmail(params))
}

export async function sendWaitlistedEmail(
  to: string,
  params: { teacherName: string; courseName: string; waitlistPosition: number; reference: string },
): Promise<string> {
  return dispatch(to, buildWaitlistedEmail(params))
}

export async function sendPromotedEmail(to: string, params: { teacherName: string } & CourseEmailDetails): Promise<string> {
  return dispatch(to, buildPromotedEmail(params))
}
