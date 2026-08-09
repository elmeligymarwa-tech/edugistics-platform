import { z } from 'zod'

import { parseRegistrationSearchParams } from '../registrations'
import type { RecipientSelectionCriteria } from './recipients'

/**
 * The wire shape the client sends for "which registrations". It only ever
 * carries ids or raw filter query-string values (the same strings already in
 * the URL) plus an explicit exclude list for the "select all matching
 * filters, minus a few" case — never an email address, course name, teacher
 * name or Zoom link. Every one of those is re-fetched server-side from the
 * ids/filters below. Shared by every action file that resolves recipients
 * (composer preview, send, test send) so "which registrations" is parsed
 * identically everywhere — not a plain 'use server' export because a
 * 'use server' file may only export async functions.
 */
export const criteriaInputSchema = z.object({
  mode: z.enum(['ids', 'filters']),
  registrationIds: z.array(z.string()).optional(),
  searchParams: z.record(z.string(), z.string()).optional(),
  excludeIds: z.array(z.string()).optional(),
  includeWaitlisted: z.boolean().optional(),
})

export type RecipientCriteriaInput = z.infer<typeof criteriaInputSchema>

export function toCriteria(input: RecipientCriteriaInput): RecipientSelectionCriteria {
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

/** Subject/body validation shared by preview, real send and test send — a newline in the subject is rejected everywhere to guard against email header injection. */
export const contentSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required.')
    .refine((value) => !/[\r\n]/.test(value), 'Subject cannot contain line breaks.'),
  body: z.string().trim().min(1, 'Message is required.'),
})

export type CampaignContentInput = z.infer<typeof contentSchema>

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
