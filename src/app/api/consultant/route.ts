import { NextResponse, type NextRequest } from 'next/server'

import { CostModelSchema, createEmptyCostModel } from '@/domain/costs'
import { ProjectSchema } from '@/domain/schema'
import { buildAnsweredSummary } from '@/lib/consultant/answered-summary'
import { ConsultantConfigError, callConsultant } from '@/lib/consultant/anthropic-client'
import { checkBreakEven } from '@/lib/consultant/break-even-check'
import { ConsultantRequestSchema, type ConsultantErrorEnvelope } from '@/lib/consultant/route-contract'
import { buildInterviewSystemPrompt, buildReviewSystemPrompt } from '@/lib/consultant/system-prompt'
import { validateProposal } from '@/lib/consultant/validate-proposal'

/**
 * Server-side only: reads ANTHROPIC_API_KEY, calls the Anthropic API, and
 * validates the model's JSON against the real domain schemas before it ever
 * reaches the client as a "proposal". The client never sees the key and
 * never talks to Anthropic directly. Runs on the default Node runtime.
 */

function errorResponse(envelope: ConsultantErrorEnvelope, status: number) {
  return NextResponse.json(envelope, { status })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsedRequest = ConsultantRequestSchema.safeParse(body)
  if (!parsedRequest.success) {
    return errorResponse(
      { error: 'invalid_request', message: 'The request body did not match the expected shape.' },
      400,
    )
  }

  const { mode, conversationHistory, userMessage, projectSnapshot, costModelSnapshot } = parsedRequest.data

  const systemPrompt =
    mode === 'interview'
      ? buildInterviewSystemPrompt(buildAnsweredSummary(projectSnapshot))
      : buildReviewSystemPrompt()

  let rawText: string
  try {
    rawText = await callConsultant({ systemPrompt, conversationHistory, userMessage })
  } catch (error) {
    if (error instanceof ConsultantConfigError) {
      return errorResponse({ error: 'missing_api_key', message: error.message }, 500)
    }
    return errorResponse(
      {
        error: 'upstream_error',
        message: error instanceof Error ? error.message : 'The consultant service failed to respond.',
      },
      502,
    )
  }

  const validated = validateProposal(rawText)
  if (!validated.ok) {
    return errorResponse(
      {
        error: 'malformed_response',
        message: 'The consultant returned a response that could not be validated against the project schema.',
        fieldErrors: validated.fieldErrors,
      },
      422,
    )
  }

  let response = validated.response

  if (mode === 'interview' && response.patch) {
    const projectResult = ProjectSchema.safeParse(projectSnapshot)
    if (projectResult.success) {
      const project = projectResult.data
      const costModelResult = costModelSnapshot ? CostModelSchema.safeParse(costModelSnapshot) : null
      const costModel = costModelResult?.success
        ? costModelResult.data
        : createEmptyCostModel(project.id, project.updatedAt)

      response = checkBreakEven(project, costModel, response)
    }
  }

  return NextResponse.json(response, { status: 200 })
}
