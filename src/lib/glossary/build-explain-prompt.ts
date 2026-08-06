import type { GlossaryEntry } from './glossary-data'

/**
 * Composes the user turn sent to /api/consultant in "explain" mode: the
 * term, its written definition (so the model doesn't just restate it), the
 * current figure and any call-site-specific context. The project and cost
 * model snapshots carry the rest of the "surrounding model context" as the
 * request's own projectSnapshot/costModelSnapshot fields.
 */
export function buildExplainPrompt(entry: GlossaryEntry, currentValue?: string, context?: string): string {
  const lines = [
    `Term: ${entry.title}`,
    `Written definition already shown to the user: ${entry.definition}`,
  ]
  if (currentValue) lines.push(`Current figure for this term in this school's model: ${currentValue}`)
  if (context) lines.push(`Where this appears: ${context}`)
  lines.push('Explain this figure specifically for this school, per your instructions.')
  return lines.join('\n')
}
