import Anthropic from '@anthropic-ai/sdk'

import type { ConsultantMessage } from './route-contract'

export const CONSULTANT_MODEL = 'claude-sonnet-4-6'

export class ConsultantConfigError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set on the server.')
    this.name = 'ConsultantConfigError'
  }
}

/** Extracts the fenced ```json ... ``` block from the model's reply, if present. */
export function extractJsonBlock(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)```/i)
  if (match) return match[1]?.trim() ?? null
  // Fall back to a bare JSON object if the model omitted the fence.
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  return null
}

/** Strips the JSON block out of the raw text, leaving just the conversational portion (used as a display fallback if JSON parsing fails entirely). */
export function stripJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/i, '').trim()
}

export async function callConsultant(params: {
  systemPrompt: string
  conversationHistory: ConsultantMessage[]
  userMessage: string
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ConsultantConfigError()

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: CONSULTANT_MODEL,
    max_tokens: 4096,
    system: params.systemPrompt,
    messages: [
      ...params.conversationHistory.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user' as const, content: params.userMessage },
    ],
  })

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text')
  if (!textBlock) throw new Error('The model returned no text content.')
  return textBlock.text
}
