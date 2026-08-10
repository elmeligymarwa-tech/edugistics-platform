import { z } from 'zod'

import { parseSubscriberSearchParams } from '@/domain/training/subscriber-filters'
import type { SubscriberSelectionCriteria } from './subscribers-admin'

/** Not defined inside actions.ts because a 'use server' file may only export async functions. */
export const RESUBSCRIBE_CONFIRMATION_WORD = 'RESUBSCRIBE'

/**
 * The wire shape the client sends for "which subscribers" — ids, or raw
 * filter query-string values (the same strings already in the URL) plus an
 * explicit exclude list for "select all matching filters, minus a few".
 * Never an email address or any other subscriber PII; every one of those is
 * re-fetched server-side from the ids/filters below. Not a 'use server' file
 * because a 'use server' file may only export async functions.
 */
export const subscriberCriteriaInputSchema = z.object({
  mode: z.enum(['ids', 'filters']),
  subscriberIds: z.array(z.string()).optional(),
  searchParams: z.record(z.string(), z.string()).optional(),
  excludeIds: z.array(z.string()).optional(),
})

export type SubscriberCriteriaInput = z.infer<typeof subscriberCriteriaInputSchema>

export function toSubscriberCriteria(input: SubscriberCriteriaInput): SubscriberSelectionCriteria {
  if (input.mode === 'ids') {
    return { mode: 'ids', subscriberIds: input.subscriberIds ?? [] }
  }
  return {
    mode: 'filters',
    filters: parseSubscriberSearchParams(input.searchParams ?? {}),
    excludeIds: input.excludeIds ?? [],
  }
}
