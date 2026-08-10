import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Pure env-var checks — no database, no network, so no MARKER/cleanup needed.
const { validateBulkEmailConfig, validateMarketingEmailConfig, findMissingEmailConfigVars } = await import('./resend-client')

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key'
  process.env.EMAIL_FROM = 'Edugistics Training <training@send.edugistics.online>'
  process.env.EMAIL_REPLY_TO = 'info@edugistics.online'
  process.env.MARKETING_EMAIL_FROM = 'Edugistics <updates@news.edugistics.online>'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('validateBulkEmailConfig', () => {
  it('returns null when every required variable is set', () => {
    expect(validateBulkEmailConfig()).toBeNull()
  })

  it('names EMAIL_FROM when it is missing', () => {
    delete process.env.EMAIL_FROM
    expect(validateBulkEmailConfig()).toBe('EMAIL_FROM')
  })

  it('names RESEND_API_KEY when it is missing, ahead of the others', () => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    expect(validateBulkEmailConfig()).toBe('RESEND_API_KEY')
  })

  it('treats an empty string the same as unset', () => {
    process.env.EMAIL_REPLY_TO = ''
    expect(validateBulkEmailConfig()).toBe('EMAIL_REPLY_TO')
  })
})

describe('validateMarketingEmailConfig', () => {
  it('returns null when every required variable is set', () => {
    expect(validateMarketingEmailConfig()).toBeNull()
  })

  it('names MARKETING_EMAIL_FROM when it is missing — this is the exact misconfiguration that orphaned two production campaigns', () => {
    delete process.env.MARKETING_EMAIL_FROM
    expect(validateMarketingEmailConfig()).toBe('MARKETING_EMAIL_FROM')
  })

  it('is unaffected by EMAIL_FROM/EMAIL_REPLY_TO being missing — marketing sends never use them', () => {
    delete process.env.EMAIL_FROM
    delete process.env.EMAIL_REPLY_TO
    expect(validateMarketingEmailConfig()).toBeNull()
  })
})

describe('findMissingEmailConfigVars', () => {
  it('returns an empty list when everything is configured', () => {
    expect(findMissingEmailConfigVars()).toEqual([])
  })

  it('lists every missing variable across both send paths, not just the first', () => {
    delete process.env.EMAIL_FROM
    delete process.env.MARKETING_EMAIL_FROM
    const missing = findMissingEmailConfigVars()
    expect(missing).toContain('EMAIL_FROM')
    expect(missing).toContain('MARKETING_EMAIL_FROM')
    expect(missing).not.toContain('RESEND_API_KEY')
  })
})
