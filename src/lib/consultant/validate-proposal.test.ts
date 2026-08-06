import { describe, expect, it } from 'vitest'

import { validateProposal } from './validate-proposal'

function validJson() {
  return {
    assistantMessage: 'What country are you in?',
    language: 'en',
    interviewComplete: false,
    patch: null,
    fieldReasons: [],
    alternatives: null,
    breakEvenWarning: null,
  }
}

describe('validateProposal', () => {
  it('parses a fenced JSON block into a validated response', () => {
    const raw = 'Sure, happy to help.\n```json\n' + JSON.stringify(validJson()) + '\n```'
    const result = validateProposal(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.response.assistantMessage).toBe(validJson().assistantMessage)
  })

  it('parses a bare JSON object with no fence', () => {
    const raw = JSON.stringify(validJson())
    const result = validateProposal(raw)
    expect(result.ok).toBe(true)
  })

  it('fails when there is no JSON at all', () => {
    const result = validateProposal('just a plain conversational reply')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors[0]).toMatch(/No JSON block/)
  })

  it('fails on malformed JSON inside the fence', () => {
    const result = validateProposal('```json\n{ not valid json\n```')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors[0]).toMatch(/JSON parse error/)
  })

  it('fails when the JSON does not match the schema', () => {
    const result = validateProposal('```json\n{"assistantMessage": 123}\n```')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.length).toBeGreaterThan(0)
  })

  it('validates a patch built from the real domain schemas, filling in defaults', () => {
    const withPatch = {
      ...validJson(),
      patch: { feePositioning: 'midMarket', staffPositions: [{ id: 'p1', title: 'Teacher', section: 'teaching' }] },
      fieldReasons: [{ path: 'feePositioning', label: 'Fee positioning', reason: 'Matches the stated market.' }],
    }
    const raw = '```json\n' + JSON.stringify(withPatch) + '\n```'
    const result = validateProposal(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const position = result.response.patch?.staffPositions?.[0]
      expect(position?.headcount).toBe(0)
      expect(position?.derivedFromCapacity).toBe(false)
    }
  })
})
