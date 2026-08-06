'use client'

import { useCallback, useState } from 'react'

import type { CostModel } from '@/domain/costs'
import type { Project } from '@/domain/schema'
import type {
  ConsultantErrorEnvelope,
  ConsultantMessage,
  ConsultantModelResponse,
} from '@/lib/consultant/route-contract'

/**
 * Drives one conversation with /api/consultant. Session-local only — not
 * persisted across reloads, since a stale interview transcript from a prior
 * session isn't useful and the route itself is stateless. Never writes to
 * project-store.ts; it only ever produces a validated proposal for the
 * caller to hand to ProposalPanel.
 */
export function useConsultantConversation(
  mode: 'interview' | 'review',
  project: Project | null,
  costModel: CostModel | null,
) {
  const [messages, setMessages] = useState<ConsultantMessage[]>([])
  const [latestResponse, setLatestResponse] = useState<ConsultantModelResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (userMessage: string) => {
      if (!project) return
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/consultant', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode,
            conversationHistory: messages,
            userMessage,
            projectSnapshot: project,
            costModelSnapshot: costModel ?? null,
          }),
        })

        const json = await response.json()

        if (!response.ok) {
          const envelope = json as ConsultantErrorEnvelope
          setError(envelope.message || 'The consultant service failed.')
          return
        }

        const modelResponse = json as ConsultantModelResponse
        setMessages((previous) => [
          ...previous,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: modelResponse.assistantMessage },
        ])
        setLatestResponse(modelResponse)
      } catch {
        setError('Could not reach the consultant service. Check your connection and try again.')
      } finally {
        setIsLoading(false)
      }
    },
    [mode, messages, project, costModel],
  )

  const reset = useCallback(() => {
    setMessages([])
    setLatestResponse(null)
    setError(null)
  }, [])

  return { messages, latestResponse, isLoading, error, send, reset }
}
