'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Sparkles, X } from 'lucide-react'

import type { Project } from '@/domain/schema'
import { useCostModel } from '@/store/project-store'
import { useConsultantUiStore, useHasAutoOpened, useIsPanelOpen } from '@/store/consultant-ui-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ProposalPanel } from './proposal-panel'
import { useConsultantConversation } from './use-consultant-conversation'

interface ConsultantPanelProps {
  project: Project
  mode?: 'interview' | 'review'
}

/**
 * Floating, collapsible rail — one instance mounted app-wide (see
 * consultant-mount.tsx) so it appears on every setup step and module page,
 * including presentation mode, without threading a slot through every
 * page's layout. Auto-opens once per project on the interview, never
 * writes to project-store.ts directly — proposals only ever get applied via
 * ProposalPanel, which the user has to act on explicitly.
 */
export function ConsultantPanel({ project, mode = 'interview' }: ConsultantPanelProps) {
  const costModel = useCostModel(project.id)
  const isOpen = useIsPanelOpen(project.id)
  const hasAutoOpened = useHasAutoOpened(project.id)
  const setPanelOpen = useConsultantUiStore((state) => state.setPanelOpen)
  const markAutoOpened = useConsultantUiStore((state) => state.markAutoOpened)

  const { messages, latestResponse, isLoading, error, send } = useConsultantConversation(mode, project, costModel)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode !== 'interview' || hasAutoOpened) return
    setPanelOpen(project.id, true)
    markAutoOpened(project.id)
    // Fires once per project id — hasAutoOpened flips true right after, so this intentionally does not re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, mode, hasAutoOpened])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, latestResponse])

  const isRtl = latestResponse?.language === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'

  const handleSend = () => {
    const trimmed = draft.trim()
    if (!trimmed || isLoading) return
    setDraft('')
    void send(trimmed)
  }

  if (!isOpen) {
    return (
      <Button
        size="icon-lg"
        className="fixed right-4 bottom-4 z-50 rounded-full shadow-lg print:hidden"
        aria-label="Open the Edugistics Implementation Consultant"
        onClick={() => setPanelOpen(project.id, true)}
      >
        <Sparkles />
      </Button>
    )
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[26rem] max-w-[calc(100vw-2rem)] print:hidden" dir={dir}>
      <Card className="flex max-h-[36rem] flex-col shadow-xl">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" />
            {mode === 'review' ? 'Consultant review' : 'Implementation Consultant'}
          </CardTitle>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Close"
            onClick={() => setPanelOpen(project.id, false)}
          >
            <X />
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-0">
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {mode === 'review'
                  ? 'Ask for a review of the current forecast, and I will flag anything that looks unrealistic.'
                  : "Tell me about the school you're planning — country, curriculum, target capacity, fee positioning — and I'll propose a starting-point setup you can review and apply."}
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? `bg-primary text-primary-foreground ${isRtl ? 'self-start' : 'self-end'}`
                    : `bg-muted text-foreground ${isRtl ? 'self-end' : 'self-start'}`
                }`}
              >
                {message.content}
              </div>
            ))}
            {latestResponse && (latestResponse.patch || latestResponse.alternatives) && (
              <ProposalPanel project={project} costModel={costModel} response={latestResponse} />
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSend()
                }
              }}
              placeholder={mode === 'review' ? 'Ask about the forecast…' : 'Type your answer…'}
              disabled={isLoading}
            />
            <Button size="sm" onClick={handleSend} disabled={isLoading || !draft.trim()}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
