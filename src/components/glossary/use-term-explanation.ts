'use client'

import { useCallback, useRef, useState } from 'react'

import type { ConsultantErrorEnvelope, ConsultantModelResponse } from '@/lib/consultant/route-contract'
import { buildExplainPrompt } from '@/lib/glossary/build-explain-prompt'
import { getGlossaryEntry } from '@/lib/glossary/glossary-data'
import { useActiveProject, useCostModel } from '@/store/project-store'
import { useCachedExplanation, useGlossaryCacheStore } from '@/store/glossary-cache-store'

/**
 * Drives the AI explanation layer for one glossary term: checks the
 * project+term cache first (so a repeat open never re-bills the consultant
 * API), and only calls /api/consultant on a genuine cache miss.
 *
 * `inFlightRef` guards against a second call landing before the first one's
 * `setIsLoading(true)` has committed — e.g. React StrictMode's dev-mode
 * double-effect-invocation, or a fast double-click — since state alone can't
 * be read synchronously across two near-simultaneous calls. Cleared again on
 * a genuine failure so a later retry (e.g. reopening the panel) still works.
 */
export function useTermExplanation(termId: string, currentValue?: string, context?: string) {
  const project = useActiveProject()
  const costModel = useCostModel(project?.id ?? '')
  const cached = useCachedExplanation(project?.id, termId)
  const setExplanation = useGlossaryCacheStore((state) => state.setExplanation)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<string | null>(null)

  const fetchExplanation = useCallback(async () => {
    const entry = getGlossaryEntry(termId)
    if (!project || !entry || cached || inFlightRef.current === termId) return
    inFlightRef.current = termId

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/consultant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'explain',
          conversationHistory: [],
          userMessage: buildExplainPrompt(entry, currentValue, context),
          projectSnapshot: project,
          costModelSnapshot: costModel ?? null,
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        const envelope = json as ConsultantErrorEnvelope
        setError(envelope.message || 'The detailed explanation is unavailable.')
        inFlightRef.current = null
        return
      }

      const modelResponse = json as ConsultantModelResponse
      setExplanation(project.id, termId, modelResponse.assistantMessage)
    } catch {
      setError('The detailed explanation is unavailable.')
      inFlightRef.current = null
    } finally {
      setIsLoading(false)
    }
    // currentValue/context intentionally excluded — a cache hit should never
    // re-fire just because the on-screen figure changed on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, costModel, termId, cached, setExplanation])

  return { explanation: cached, isLoading, error, fetchExplanation }
}
