import 'server-only'

import { randomUUID } from 'node:crypto'

import type { CreateBatchEmailOptions } from 'resend'
import { getResendClient } from './resend-client'

const MAX_RATE_LIMIT_RETRIES = 5
const RATE_LIMIT_BASE_BACKOFF_MS = 1000

/**
 * Resend's batch endpoint accepts up to 100 messages per call (see
 * https://resend.com/docs/dashboard/emails/batch-sending). Deliberately half
 * that, not the maximum: if a sending invocation is killed between Resend
 * accepting a batch and the caller writing SENT to those rows, every
 * recipient in that batch is left PENDING and would be re-sent on resume —
 * a real, unavoidable at-least-once-delivery race. A smaller batch bounds
 * how many people that race can affect, in exchange for still cutting the
 * recipient-count-to-API-call ratio roughly 50x against sending one call per
 * recipient.
 */
export const BATCH_SIZE = 50

/**
 * A sending loop built on top of this module should self-limit to this
 * budget and voluntarily checkpoint (stop cleanly, with every row so far
 * durably recorded) rather than run until a serverless platform kills it —
 * see send-marketing-campaign.ts and send-campaign.ts, both of which run
 * inside a single invocation extended past the response via Next's after(),
 * with no `maxDuration` configured anywhere in this codebase. Deliberately
 * conservative: comfortably under even a bare 60s function timeout,
 * regardless of what the platform is actually configured to allow, so
 * raising `maxDuration` is never what makes a large send finish.
 */
export const TIME_BUDGET_MS = 45_000

export interface BatchRecipient {
  recipientId: string
  email: CreateBatchEmailOptions
}

export interface BatchOutcome {
  recipientId: string
  ok: boolean
  messageId?: string
  error?: string
}

interface BatchValidationError {
  index: number
  message: string
}

/**
 * Maps Resend's batch response back onto the recipients that were sent, by
 * position. `batchValidation: 'permissive'` means one bad recipient doesn't
 * reject the whole call: Resend returns `errors`, naming the *original*
 * input index of every message it rejected, and `data`, containing one
 * entry per message it *did* accept — in the same relative order as the
 * input, with rejected indices simply absent (not null-padded). So: walk
 * the original list in order; an index present in `errors` failed at that
 * position; every other index consumes the next `data` entry in turn. Pure
 * and DB/network-free by design — see batch-send.test.ts.
 */
export function mapBatchResponseToOutcomes(
  recipients: readonly Pick<BatchRecipient, 'recipientId'>[],
  data: readonly { id: string }[],
  errors: readonly BatchValidationError[],
): BatchOutcome[] {
  const errorByIndex = new Map(errors.map((e) => [e.index, e.message]))
  const successes = [...data]
  return recipients.map((recipient, index) => {
    const validationError = errorByIndex.get(index)
    if (validationError) {
      return { recipientId: recipient.recipientId, ok: false, error: validationError }
    }
    const success = successes.shift()
    if (!success) {
      return { recipientId: recipient.recipientId, ok: false, error: 'Resend returned no result for this recipient.' }
    }
    return { recipientId: recipient.recipientId, ok: true, messageId: success.id }
  })
}

/**
 * One Resend batch call carrying every recipient passed in, retried as a
 * whole against the same idempotencyKey on a rate-limit response, so a
 * transient retry can't double-send a batch Resend actually already
 * accepted. A batch that fails outright after retries (rather than a
 * per-recipient validation error) fails every recipient in it with the same
 * reason — indistinguishable at that point, same as any other network
 * failure. Shared by every campaign type that sends in batches (marketing
 * and course-registration bulk email) so this mapping/retry logic exists in
 * exactly one place.
 */
export async function dispatchBatch(recipients: BatchRecipient[]): Promise<BatchOutcome[]> {
  if (recipients.length === 0) return []

  const resend = getResendClient()
  const idempotencyKey = randomUUID()
  const payload = recipients.map((r) => r.email)

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const { data, error } = await resend.batch.send(payload, { idempotencyKey, batchValidation: 'permissive' })

    if (!error && data) {
      const errors = 'errors' in data && Array.isArray(data.errors) ? (data.errors as BatchValidationError[]) : []
      return mapBatchResponseToOutcomes(recipients, data.data, errors)
    }

    const isRateLimited = error?.name === 'rate_limit_exceeded'
    if (isRateLimited && attempt < MAX_RATE_LIMIT_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BASE_BACKOFF_MS * 2 ** attempt))
      continue
    }

    const reason = error?.message ?? 'Unknown error from the email provider.'
    return recipients.map((r) => ({ recipientId: r.recipientId, ok: false, error: reason }))
  }

  const reason = 'Rate limited by the email provider after repeated retries.'
  return recipients.map((r) => ({ recipientId: r.recipientId, ok: false, error: reason }))
}
