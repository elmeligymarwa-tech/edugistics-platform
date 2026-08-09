'use server'

import { z } from 'zod'

import { getDefaultCampaignTemplate } from '@/domain/training/campaign-templates'
import { usesZoomLinkToken } from '@/domain/training/personalization'
import { CampaignEmailType } from '@/domain/training/schema'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { renderCampaignEmail } from '@/lib/training/email/campaign-render'
import { renderCampaignBodyHtml } from '@/lib/training/email/rich-text'
import { resolveRecipients, type RecipientSelectionCriteria } from '@/lib/training/email/recipients'
import { parseRegistrationSearchParams } from '@/lib/training/registrations'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> }

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/**
 * The wire shape the client sends for "which registrations". It only ever
 * carries ids or raw filter query-string values (the same strings already in
 * the URL) plus an explicit exclude list for the "select all matching
 * filters, minus a few" case — never an email address, course name, teacher
 * name or Zoom link. Every one of those is re-fetched server-side from the
 * ids/filters below.
 */
const criteriaInputSchema = z.object({
  mode: z.enum(['ids', 'filters']),
  registrationIds: z.array(z.string()).optional(),
  searchParams: z.record(z.string(), z.string()).optional(),
  excludeIds: z.array(z.string()).optional(),
  includeWaitlisted: z.boolean().optional(),
})

export type RecipientCriteriaInput = z.infer<typeof criteriaInputSchema>

function toCriteria(input: RecipientCriteriaInput): RecipientSelectionCriteria {
  if (input.mode === 'ids') {
    return { mode: 'ids', registrationIds: input.registrationIds ?? [], includeWaitlisted: input.includeWaitlisted }
  }
  return {
    mode: 'filters',
    filters: parseRegistrationSearchParams(input.searchParams ?? {}),
    excludeIds: input.excludeIds ?? [],
    includeWaitlisted: input.includeWaitlisted,
  }
}

export interface RecipientSummary {
  rawRegistrationCount: number
  uniqueTeacherCount: number
  courses: { id: string; name: string }[]
  waitlistedRawCount: number
  /** The single course's stored Zoom link, when the selection resolves to exactly one course — null otherwise, including when that one course simply has no link. Powers the composer's "Insert Zoom Link" control. */
  singleCourseZoomLink: string | null
}

/** Recipient counts and the distinct course list for a selection — never returns an email address or any other recipient PII. */
export async function getRecipientSummaryAction(input: RecipientCriteriaInput): Promise<ActionResult<RecipientSummary>> {
  await requireAdminSession()

  const parsed = criteriaInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid selection.' }

  const resolution = await resolveRecipients(toCriteria(parsed.data))
  return {
    success: true,
    data: {
      rawRegistrationCount: resolution.rawRegistrationCount,
      uniqueTeacherCount: resolution.uniqueTeacherCount,
      courses: resolution.courses,
      waitlistedRawCount: resolution.waitlistedRawCount,
      singleCourseZoomLink: resolution.courses.length === 1 ? resolution.recipients[0]?.zoomLink ?? null : null,
    },
  }
}

export interface TemplateDefaults {
  subject: string
  body: string
  overrideApplied: boolean
}

/**
 * Populates the composer for a chosen template. Only the Training Reminder
 * template can be overridden, and only when the selection resolves to
 * exactly one course that has its own reminderSubject/reminderMessage
 * stored — those course fields are read here, server-side, never supplied
 * by the client.
 */
export async function getTemplateForSelectionAction(
  emailType: string,
  input: RecipientCriteriaInput,
): Promise<ActionResult<TemplateDefaults>> {
  await requireAdminSession()

  const parsedType = CampaignEmailType.safeParse(emailType)
  if (!parsedType.success) return { success: false, error: 'Invalid template.' }

  const parsedInput = criteriaInputSchema.safeParse(input)
  if (!parsedInput.success) return { success: false, error: 'Invalid selection.' }

  const fallback = getDefaultCampaignTemplate(parsedType.data)

  if (parsedType.data === 'REMINDER') {
    const resolution = await resolveRecipients(toCriteria(parsedInput.data))
    const [example] = resolution.recipients
    if (resolution.courses.length === 1 && example && (example.reminderSubject || example.reminderMessage)) {
      return {
        success: true,
        data: {
          subject: example.reminderSubject ?? fallback.subject,
          body: example.reminderMessage ?? fallback.body,
          overrideApplied: true,
        },
      }
    }
  }

  return { success: true, data: { ...fallback, overrideApplied: false } }
}

const contentSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required.')
    .refine((value) => !/[\r\n]/.test(value), 'Subject cannot contain line breaks.'),
  body: z.string().trim().min(1, 'Message is required.'),
})

export interface CampaignPreview {
  uniqueTeacherCount: number
  rawRegistrationCount: number
  courses: { id: string; name: string }[]
  renderedBodyHtml: string
  zoomLinkMissingCount: number
  example: {
    recipientName: string
    subject: string
    html: string
    text: string
  }
}

/**
 * Builds the preview step: recipient counts, the distinct course list, the
 * body rendered through the markdown-lite formatter (tokens still visible,
 * so the administrator sees exactly the structure they authored), and one
 * fully personalised example rendered from a real recipient's own data.
 */
export async function previewCampaignAction(
  input: RecipientCriteriaInput,
  content: { subject: string; body: string },
): Promise<ActionResult<CampaignPreview>> {
  await requireAdminSession()

  const parsedInput = criteriaInputSchema.safeParse(input)
  if (!parsedInput.success) return { success: false, error: 'Invalid selection.' }

  const parsedContent = contentSchema.safeParse(content)
  if (!parsedContent.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsedContent.error) }
  }

  const resolution = await resolveRecipients(toCriteria(parsedInput.data))
  const example = resolution.recipients[0]
  if (!example) {
    return { success: false, error: 'No recipients match this selection.' }
  }

  const usesZoomLink = usesZoomLinkToken(parsedContent.data.subject) || usesZoomLinkToken(parsedContent.data.body)
  const zoomLinkMissingCount = usesZoomLink ? resolution.recipients.filter((r) => !r.zoomLink).length : 0

  const rendered = renderCampaignEmail(parsedContent.data.subject, parsedContent.data.body, {
    firstName: example.firstName,
    fullName: example.fullName,
    courseName: example.courseName,
    courseDate: example.courseDate,
    courseTime: example.courseTime,
    schoolName: example.schoolName,
    zoomLink: example.zoomLink ?? '',
    reference: example.reference,
  })

  return {
    success: true,
    data: {
      uniqueTeacherCount: resolution.uniqueTeacherCount,
      rawRegistrationCount: resolution.rawRegistrationCount,
      courses: resolution.courses,
      renderedBodyHtml: renderCampaignBodyHtml(parsedContent.data.body),
      zoomLinkMissingCount,
      example: {
        recipientName: example.fullName,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
    },
  }
}
