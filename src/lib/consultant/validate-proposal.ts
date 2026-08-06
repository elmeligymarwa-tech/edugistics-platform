import { extractJsonBlock } from './anthropic-client'
import { ConsultantModelResponseSchema, type ConsultantModelResponse } from './route-contract'

export type ValidateProposalResult =
  | { ok: true; response: ConsultantModelResponse }
  | { ok: false; fieldErrors: string[] }

/**
 * Extracts the model's JSON block and validates it against
 * ConsultantModelResponseSchema — whose `patch` field is built from the
 * real, locked domain Zod schemas (`.partial()`), so this one safeParse
 * call is also the domain-schema validation. Malformed or invalid output
 * never reaches the client as a "proposal" — the route returns a typed
 * error instead, so the project is never half-applied.
 */
export function validateProposal(rawText: string): ValidateProposalResult {
  const jsonText = extractJsonBlock(rawText)
  if (!jsonText) return { ok: false, fieldErrors: ['No JSON block found in the model response.'] }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (error) {
    return { ok: false, fieldErrors: [`JSON parse error: ${error instanceof Error ? error.message : String(error)}`] }
  }

  const result = ConsultantModelResponseSchema.safeParse(parsed)
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    return { ok: false, fieldErrors }
  }

  return { ok: true, response: result.data }
}
