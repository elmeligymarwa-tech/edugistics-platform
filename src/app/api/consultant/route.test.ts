import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

const { POST } = await import('./route')

function makeRequest(body: unknown): Parameters<typeof POST>[0] {
  return new Request('http://localhost/api/consultant', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as Parameters<typeof POST>[0]
}

function validRequestBody() {
  return {
    mode: 'interview',
    conversationHistory: [],
    userMessage: 'Hello',
    projectSnapshot: {},
    costModelSnapshot: null,
  }
}

describe('POST /api/consultant', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey
  })

  it('returns 400 for an invalid request body', async () => {
    const response = await POST(makeRequest({ mode: 'not-a-mode' }))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('invalid_request')
  })

  it('returns 500 when the API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const response = await POST(makeRequest(validRequestBody()))
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error).toBe('missing_api_key')
  })

  it('returns 502 when the Anthropic API call fails', async () => {
    mockCreate.mockRejectedValue(new Error('network down'))
    const response = await POST(makeRequest(validRequestBody()))
    expect(response.status).toBe(502)
    const json = await response.json()
    expect(json.error).toBe('upstream_error')
  })

  it('returns 422 when the model response has no JSON block', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'just a conversational reply, no JSON' }],
    })
    const response = await POST(makeRequest(validRequestBody()))
    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error).toBe('malformed_response')
  })

  it('returns 422 when the model JSON fails schema validation', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"assistantMessage": 123}\n```' }],
    })
    const response = await POST(makeRequest(validRequestBody()))
    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error).toBe('malformed_response')
    expect(json.fieldErrors.length).toBeGreaterThan(0)
  })

  it('returns 200 with a validated envelope on success', async () => {
    const modelJson = {
      assistantMessage: 'Thanks, what country are you in?',
      language: 'en',
      interviewComplete: false,
      patch: null,
      fieldReasons: [],
      alternatives: null,
      breakEvenWarning: null,
    }
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(modelJson) + '\n```' }],
    })
    const response = await POST(makeRequest(validRequestBody()))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.assistantMessage).toBe(modelJson.assistantMessage)
    expect(json.language).toBe('en')
  })

  it('runs the review-mode system prompt without requiring a project snapshot', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text:
            '```json\n' +
            JSON.stringify({
              assistantMessage: 'Your net margin looks thin in year one.',
              language: 'en',
              interviewComplete: true,
              patch: null,
              fieldReasons: [],
              alternatives: null,
              breakEvenWarning: null,
            }) +
            '\n```',
        },
      ],
    })
    const response = await POST(
      makeRequest({
        mode: 'review',
        conversationHistory: [],
        userMessage: 'Net revenue year 1: 2,000,000. Net profit year 1: -300,000.',
        projectSnapshot: {},
        costModelSnapshot: null,
      }),
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.interviewComplete).toBe(true)
  })
})
