import { describe, expect, it } from 'vitest'

import { POST } from './route'

// Uses a non-existent (but well-formed) courseId so each call reaches
// registerForCourse's real-database row-lock check and rejects with 409
// before writing anything — enough to exercise the rate limiter honestly
// without creating registration rows.
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'rate-limit-test-nonexistent-course',
    fullName: 'Test Teacher',
    email: 'rate-limit-test@test.local',
    phone: '+201000000000',
    schoolName: 'Test School',
    subject: 'Mathematics',
    grade: 'Grade 3',
    marketingConsent: false,
    ...overrides,
  }
}

function makeRequest(body: unknown, ip: string) {
  return new Request('http://localhost/api/training/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  }) as Parameters<typeof POST>[0]
}

let ipCounter = 0
function uniqueIp() {
  ipCounter += 1
  return `10.1.0.${ipCounter}`
}

describe('POST /api/training/register', () => {
  it('rejects each missing required field', async () => {
    const fields = ['courseId', 'fullName', 'email', 'phone', 'schoolName', 'subject', 'grade']
    for (const field of fields) {
      const body = validBody({ [field]: '' })
      const response = await POST(makeRequest(body, uniqueIp()))
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(Object.keys(json.fieldErrors ?? {})).toContain(field)
    }
  })

  it('accepts a missing address — it is optional on the public form', async () => {
    const response = await POST(makeRequest(validBody({ address: undefined }), uniqueIp()))
    // 409 (course not found) proves validation passed and the request reached registerForCourse.
    expect(response.status).toBe(409)
  })

  it('silently drops a submission where the honeypot field is filled', async () => {
    const response = await POST(makeRequest(validBody({ website: 'http://spam.example.com' }), uniqueIp()))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).not.toMatch(/highlighted fields/i)
  })

  it('rate limits after 5 submissions from the same IP within the window', async () => {
    const ip = uniqueIp()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(makeRequest(validBody(), ip))
      expect(response.status).toBe(409) // course not found, but rate limit not yet triggered
    }
    const sixth = await POST(makeRequest(validBody(), ip))
    expect(sixth.status).toBe(429)
  })

  it('does not rate limit a different IP', async () => {
    const freshIp = uniqueIp()
    const response = await POST(makeRequest(validBody(), freshIp))
    expect(response.status).toBe(409) // reaches registerForCourse, not blocked by rate limit
  })
})
