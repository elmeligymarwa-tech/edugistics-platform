import { formatCourseFee } from '@/domain/training/format'
import { escapeHtml } from './html'

export interface EmailContent {
  subject: string
  html: string
  text: string
}

/** Built from a registration's own stored snapshot fields, never recalculated — see register-for-course.ts and resendRegistrationEmailAction. */
export interface PromoEmailDetails {
  code: string
  discountLabel: string
  discountAmount: number
  originalFee: number
}

export interface CourseEmailDetails {
  courseName: string
  courseDateLong: string
  courseTimeRange: string
  deliveryMethodLabel: string
  location: string | null
  joiningInstructions: string | null
  /** The fee to invoice — the promo's finalFee when a promo was applied, otherwise the full course fee. */
  feeAmount: number
  currency: string
  reference: string
  promo?: PromoEmailDetails | null
}

export const BRAND_NAVY = '#2b3a67'
export const BRAND_TEAL = '#3e8e96'
export const INK = '#17213d'
export const INK_SECONDARY = '#4c5570'
export const BORDER = '#e2e5ec'

/** The one reusable Edugistics email shell — reused by every transactional and bulk-campaign email so they share the same branding. */
export function renderLayout(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Edugistics Training</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f7fa;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
            <tr>
              <td style="padding:24px 24px 0 24px;">
                <div style="font-size:20px;font-weight:700;color:${BRAND_NAVY};letter-spacing:-0.01em;">Edugistics</div>
                <div style="font-size:13px;color:${INK_SECONDARY};margin-top:2px;">Teacher Training</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 24px 24px;color:${INK};font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid ${BORDER};color:${INK_SECONDARY};font-size:12px;">
                This email was sent because you registered for a course on the Edugistics training programme.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

const PAYMENT_NOTE = 'Payment is not collected through the registration system. Payment instructions will be sent separately. The final fee above is the amount that will be invoiced.'

function feeHtml(feeAmount: number, currency: string, promo?: PromoEmailDetails | null): string {
  if (promo) {
    return `<p style="margin:0 0 2px 0;">Original fee: ${escapeHtml(formatCourseFee(promo.originalFee, currency))}</p>
<p style="margin:0 0 2px 0;">Promo code: ${escapeHtml(promo.code)}</p>
<p style="margin:0 0 2px 0;">Discount: ${escapeHtml(promo.discountLabel)}</p>
<p style="margin:0 0 2px 0;">You save: ${escapeHtml(formatCourseFee(promo.discountAmount, currency))}</p>
<p style="margin:0 0 4px 0;"><strong>Final fee: ${escapeHtml(formatCourseFee(feeAmount, currency))}</strong></p>
<p style="margin:0 0 12px 0;color:${INK_SECONDARY};font-size:13px;">${PAYMENT_NOTE}</p>`
  }
  if (feeAmount === 0) {
    return `<p style="margin:0 0 12px 0;"><strong>Fee:</strong> Free of charge.</p>`
  }
  return `<p style="margin:0 0 4px 0;"><strong>Fee:</strong> ${escapeHtml(formatCourseFee(feeAmount, currency))}</p>
<p style="margin:0 0 12px 0;color:${INK_SECONDARY};font-size:13px;">Payment is not collected through the registration system. Payment instructions will be sent separately.</p>`
}

function feeText(feeAmount: number, currency: string, promo?: PromoEmailDetails | null): string {
  if (promo) {
    return `Original fee: ${formatCourseFee(promo.originalFee, currency)}
Promo code: ${promo.code}
Discount: ${promo.discountLabel}
You save: ${formatCourseFee(promo.discountAmount, currency)}
Final fee: ${formatCourseFee(feeAmount, currency)}
${PAYMENT_NOTE}`
  }
  if (feeAmount === 0) return 'Fee: Free of charge.'
  return `Fee: ${formatCourseFee(feeAmount, currency)}\nPayment is not collected through the registration system. Payment instructions will be sent separately.`
}

function joiningHtml(details: CourseEmailDetails): string {
  const line = details.joiningInstructions ?? details.location
  if (!line) return ''
  return `<p style="margin:0 0 12px 0;"><strong>Joining instructions:</strong> ${escapeHtml(line)}</p>`
}

function joiningText(details: CourseEmailDetails): string {
  const line = details.joiningInstructions ?? details.location
  return line ? `Joining instructions: ${line}\n` : ''
}

export function buildConfirmedEmail(params: { teacherName: string } & CourseEmailDetails): EmailContent {
  const { teacherName, courseName, courseDateLong, courseTimeRange, deliveryMethodLabel, feeAmount, currency, reference, promo } = params
  const subject = `Registration confirmed: ${courseName}`

  const html = renderLayout(
    `You're registered for ${courseName}.`,
    `<h1 style="margin:0 0 16px 0;font-size:19px;color:${BRAND_NAVY};">Registration confirmed</h1>
<p style="margin:0 0 16px 0;">Thank you, ${escapeHtml(teacherName)}. You are registered for:</p>
<p style="margin:0 0 4px 0;font-size:17px;font-weight:600;color:${BRAND_NAVY};">${escapeHtml(courseName)}</p>
<p style="margin:0 0 4px 0;">${escapeHtml(courseDateLong)}</p>
<p style="margin:0 0 12px 0;">${escapeHtml(courseTimeRange)}</p>
<p style="margin:0 0 12px 0;"><strong>Delivery:</strong> ${escapeHtml(deliveryMethodLabel)}</p>
${joiningHtml(params)}
${feeHtml(feeAmount, currency, promo)}
<p style="margin:16px 0 0 0;padding:12px;background-color:#f6f7fa;border-radius:8px;font-size:13px;color:${INK_SECONDARY};">Reference: <strong style="color:${INK};">${escapeHtml(reference)}</strong></p>`,
  )

  const text = `Registration confirmed

Thank you, ${teacherName}. You are registered for:
${courseName}
${courseDateLong}
${courseTimeRange}
Delivery: ${deliveryMethodLabel}
${joiningText(params)}${feeText(feeAmount, currency, promo)}

Reference: ${reference}`

  return { subject, html, text }
}

export function buildWaitlistedEmail(params: {
  teacherName: string
  courseName: string
  waitlistPosition: number
  reference: string
}): EmailContent {
  const { teacherName, courseName, waitlistPosition, reference } = params
  const subject = `You're on the waiting list: ${courseName}`

  const html = renderLayout(
    `You're number ${waitlistPosition} on the waiting list for ${courseName}.`,
    `<h1 style="margin:0 0 16px 0;font-size:19px;color:${BRAND_TEAL};">You are on the waiting list</h1>
<p style="margin:0 0 16px 0;">Thank you, ${escapeHtml(teacherName)}.</p>
<p style="margin:0 0 16px 0;"><strong>${escapeHtml(courseName)}</strong> is currently full. You are number <strong>${waitlistPosition}</strong> on the waiting list.</p>
<p style="margin:0 0 16px 0;">You do not yet have a confirmed place. We will email you if a place becomes available.</p>
<p style="margin:16px 0 0 0;padding:12px;background-color:#f6f7fa;border-radius:8px;font-size:13px;color:${INK_SECONDARY};">Reference: <strong style="color:${INK};">${escapeHtml(reference)}</strong></p>`,
  )

  const text = `You are on the waiting list

Thank you, ${teacherName}.
${courseName} is currently full. You are number ${waitlistPosition} on the waiting list.
You do not yet have a confirmed place. We will email you if a place becomes available.

Reference: ${reference}`

  return { subject, html, text }
}

export function buildPromotedEmail(params: { teacherName: string } & CourseEmailDetails): EmailContent {
  const { teacherName, courseName, courseDateLong, courseTimeRange, deliveryMethodLabel, feeAmount, currency, reference, promo } = params
  const subject = `A place is now confirmed: ${courseName}`

  const html = renderLayout(
    `Your place on ${courseName} is now confirmed.`,
    `<h1 style="margin:0 0 16px 0;font-size:19px;color:${BRAND_NAVY};">Your place is confirmed</h1>
<p style="margin:0 0 16px 0;">Good news, ${escapeHtml(teacherName)} — a place has opened up and your seat is now confirmed for:</p>
<p style="margin:0 0 4px 0;font-size:17px;font-weight:600;color:${BRAND_NAVY};">${escapeHtml(courseName)}</p>
<p style="margin:0 0 4px 0;">${escapeHtml(courseDateLong)}</p>
<p style="margin:0 0 12px 0;">${escapeHtml(courseTimeRange)}</p>
<p style="margin:0 0 12px 0;"><strong>Delivery:</strong> ${escapeHtml(deliveryMethodLabel)}</p>
${joiningHtml(params)}
${feeHtml(feeAmount, currency, promo)}
<p style="margin:16px 0 0 0;padding:12px;background-color:#f6f7fa;border-radius:8px;font-size:13px;color:${INK_SECONDARY};">Reference: <strong style="color:${INK};">${escapeHtml(reference)}</strong></p>`,
  )

  const text = `Your place is confirmed

Good news, ${teacherName} — a place has opened up and your seat is now confirmed for:
${courseName}
${courseDateLong}
${courseTimeRange}
Delivery: ${deliveryMethodLabel}
${joiningText(params)}${feeText(feeAmount, currency, promo)}

Reference: ${reference}`

  return { subject, html, text }
}
