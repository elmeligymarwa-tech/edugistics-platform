// Pure logic plus a mocked global fetch — no database, no network, so no
// MARKER/cleanup needed and no dependency on which database DATABASE_URL
// actually points at while this file runs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PRODUCTION_URL = 'postgresql://postgres.ndkhfqhyuglwtpwlxrxo:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
const TEST_URL = 'postgresql://postgres.paipadncvmjikeedxnth:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
const UNKNOWN_URL = 'postgresql://postgres:secret@localhost:5432/some_other_db'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  delete process.env.META_CAPI_ACCESS_TOKEN
  delete process.env.META_CAPI_TEST_EVENT_CODE
  delete process.env.DATABASE_URL
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('resolveSendMode', () => {
  it('is disabled-no-token when META_CAPI_ACCESS_TOKEN is unset, regardless of DATABASE_URL', async () => {
    const { resolveSendMode } = await import('./send-conversion-event')
    process.env.DATABASE_URL = PRODUCTION_URL
    expect(resolveSendMode()).toEqual({ kind: 'disabled-no-token' })
  })

  it('is live when the token is set and DATABASE_URL resolves to production', async () => {
    const { resolveSendMode } = await import('./send-conversion-event')
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = PRODUCTION_URL
    expect(resolveSendMode()).toEqual({ kind: 'live' })
  })

  it('is disabled-no-test-code when the token is set, DATABASE_URL resolves to TEST, and no test_event_code is set', async () => {
    const { resolveSendMode } = await import('./send-conversion-event')
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = TEST_URL
    expect(resolveSendMode()).toEqual({ kind: 'disabled-no-test-code', environment: 'TEST' })
  })

  it('is disabled-no-test-code when DATABASE_URL is unrecognised (UNKNOWN) and no test_event_code is set', async () => {
    const { resolveSendMode } = await import('./send-conversion-event')
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = UNKNOWN_URL
    expect(resolveSendMode()).toEqual({ kind: 'disabled-no-test-code', environment: 'UNKNOWN' })
  })

  it('is disabled-no-test-code when DATABASE_URL is not even set', async () => {
    const { resolveSendMode } = await import('./send-conversion-event')
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    expect(resolveSendMode()).toEqual({ kind: 'disabled-no-test-code', environment: 'UNKNOWN' })
  })

  it('is test when the token and a test_event_code are both set and DATABASE_URL is not production', async () => {
    const { resolveSendMode } = await import('./send-conversion-event')
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.META_CAPI_TEST_EVENT_CODE = 'TEST12345'
    process.env.DATABASE_URL = TEST_URL
    expect(resolveSendMode()).toEqual({ kind: 'test', testEventCode: 'TEST12345' })
  })

  it('is live, never test, when DATABASE_URL is production even if a test_event_code happens to be set', async () => {
    // The production denylist must never be talked out of firing by a
    // leftover test_event_code — same principle as
    // vitest.database-guard.ts's denylist never being satisfiable by its
    // allowlist marker.
    const { resolveSendMode } = await import('./send-conversion-event')
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.META_CAPI_TEST_EVENT_CODE = 'TEST12345'
    process.env.DATABASE_URL = PRODUCTION_URL
    expect(resolveSendMode()).toEqual({ kind: 'live' })
  })
})

const baseInput = {
  eventName: 'CompleteRegistration' as const,
  eventId: 'reg-EDU-2026-ABC123:CompleteRegistration',
  actionSource: 'website' as const,
  eventSourceUrl: 'https://edugistics.online/training',
  courseName: 'Assessment Design',
  clientIpAddress: '203.0.113.5',
  clientUserAgent: 'Mozilla/5.0 (test)',
}

describe('sendConversionEvent', () => {
  it('sends nothing and does not call fetch when disabled (no token)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { sendConversionEvent } = await import('./send-conversion-event')

    await sendConversionEvent(baseInput)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing and does not call fetch when disabled (test env, no test_event_code)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = TEST_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await sendConversionEvent(baseInput)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a live event with no test_event_code and exactly the allowed fields when DATABASE_URL is production', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = PRODUCTION_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await sendConversionEvent(baseInput)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('graph.facebook.com')
    expect(url).toContain('2040486313339822')
    expect(url).toContain('access_token=token')

    const body = JSON.parse(init.body)
    expect(body.test_event_code).toBeUndefined()
    expect(body.data).toHaveLength(1)
    const event = body.data[0]
    expect(Object.keys(event).sort()).toEqual(
      ['action_source', 'custom_data', 'event_id', 'event_name', 'event_source_url', 'event_time', 'user_data'].sort(),
    )
    expect(event.event_name).toBe('CompleteRegistration')
    expect(event.event_id).toBe(baseInput.eventId)
    expect(event.event_source_url).toBe(baseInput.eventSourceUrl)
    expect(event.action_source).toBe('website')
    expect(Object.keys(event.custom_data)).toEqual(['course_name'])
    expect(event.custom_data.course_name).toBe(baseInput.courseName)
    expect(Object.keys(event.user_data).sort()).toEqual(['client_ip_address', 'client_user_agent'])
    expect(event.user_data.client_ip_address).toBe(baseInput.clientIpAddress)
    expect(event.user_data.client_user_agent).toBe(baseInput.clientUserAgent)
    expect(typeof event.event_time).toBe('number')
  })

  it('tags the event with test_event_code on every event when in test mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.META_CAPI_TEST_EVENT_CODE = 'TEST12345'
    process.env.DATABASE_URL = TEST_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await sendConversionEvent(baseInput)
    await sendConversionEvent({ ...baseInput, eventId: 'reg-EDU-2026-XYZ789:CompleteRegistration' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(call[1].body)
      expect(body.test_event_code).toBe('TEST12345')
    }
  })

  it('never throws when the network call itself rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    )
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = PRODUCTION_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await expect(sendConversionEvent(baseInput)).resolves.toBeUndefined()
  })

  it('never throws when Meta responds with a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('Invalid parameter') }),
    )
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = PRODUCTION_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await expect(sendConversionEvent(baseInput)).resolves.toBeUndefined()
  })

  it('logs the resolved mode only once per process, not once per event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = PRODUCTION_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await sendConversionEvent(baseInput)
    await sendConversionEvent({ ...baseInput, eventId: 'reg-EDU-2026-XYZ789:CompleteRegistration' })

    const modeLines = logSpy.mock.calls.filter(([line]) => typeof line === 'string' && line.startsWith('[meta-capi] live:'))
    expect(modeLines).toHaveLength(1)
    logSpy.mockRestore()
  })

  it('omits event_source_url and user_data for a system_generated event with no client info (waitlist promotion)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = PRODUCTION_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await sendConversionEvent({
      eventName: 'CompleteRegistration',
      eventId: 'EDU-2026-ABC123:CompleteRegistration:1700000000000',
      actionSource: 'system_generated',
      courseName: 'Assessment Design',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    const event = body.data[0]
    expect(event.action_source).toBe('system_generated')
    expect(event.event_source_url).toBeUndefined()
    expect(event.user_data).toBeUndefined()
    expect(Object.keys(event).sort()).toEqual(['action_source', 'custom_data', 'event_id', 'event_name', 'event_time'].sort())
  })

  it('still respects environment gating for a system_generated event — sends nothing outside production without a test_event_code', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    process.env.META_CAPI_ACCESS_TOKEN = 'token'
    process.env.DATABASE_URL = TEST_URL
    const { sendConversionEvent } = await import('./send-conversion-event')

    await sendConversionEvent({
      eventName: 'CompleteRegistration',
      eventId: 'EDU-2026-ABC123:CompleteRegistration:1700000000000',
      actionSource: 'system_generated',
      courseName: 'Assessment Design',
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
