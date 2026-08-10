import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }),
}))

// This file's own endpoint rate limit isn't one of the behaviours under test here — bypassing it
// keeps these tests independent of call ordering/count. The provider rate-limit backoff (a distinct
// concern — Resend telling us to slow down) is exercised separately below via the mocked Resend client.
vi.mock('@/lib/training/rate-limit', () => ({
  checkRateLimit: () => true,
  clientIpFromHeaders: () => '127.0.0.1',
}))

let capturedWork: (() => Promise<void>) | null = null
vi.mock('@/lib/training/background', () => ({
  runAfterResponse: (work: () => Promise<void>) => {
    capturedWork = work
  },
}))

const sendMock = vi.fn()
const MARKETING_FROM = 'Edugistics <updates@news.edugistics.online>'
const TRANSACTIONAL_FROM = 'Edugistics Training <training@send.edugistics.online>'
const validateMarketingEmailConfigMock = vi.fn<() => string | null>(() => null)
vi.mock('@/lib/training/email/resend-client', () => ({
  getResendClient: () => ({ emails: { send: (...args: unknown[]) => sendMock(...args) } }),
  getMarketingEmailFrom: () => MARKETING_FROM,
  getEmailFrom: () => TRANSACTIONAL_FROM,
  getEmailReplyTo: () => 'info@edugistics.online',
  validateMarketingEmailConfig: () => validateMarketingEmailConfigMock(),
}))

const {
  sendMarketingCampaignAction,
  getMarketingCampaignStatusAction,
  retryFailedMarketingRecipientsAction,
  sendTestMarketingEmailAction,
} = await import('./send-actions')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning, following the pattern in registrations/send-actions.test.ts.
// Hits the real database; only the Resend network boundary is mocked.
const MARKER = 'marketing-send-actions-test'
const teacherIds: string[] = []
const subscriberIds: string[] = []
const campaignIds: string[] = []

let teacherCounter = 0
async function makeSubscriber(overrides: { status?: 'SUBSCRIBED' | 'UNSUBSCRIBED' } = {}) {
  teacherCounter += 1
  const email = `${MARKER}-${Date.now()}-${teacherCounter}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${teacherCounter}`,
      phone: `+2010003${teacherCounter}`,
      phoneNormalised: `+2010003${teacherCounter}`,
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
  teacherIds.push(teacher.id)

  const status = overrides.status ?? 'SUBSCRIBED'
  const now = new Date()
  const subscriber = await prisma.subscriber.create({
    data: {
      teacherId: teacher.id,
      emailNormalised: email,
      status,
      subscribedAt: now,
      unsubscribedAt: status === 'UNSUBSCRIBED' ? now : null,
      consentSource: 'TRAINING_REGISTRATION',
      consentWordingVersion: 'v1',
      unsubscribeToken: `${MARKER}-token-${teacher.id}`,
    },
  })
  subscriberIds.push(subscriber.id)
  return { teacher, subscriber }
}

function successResponse(id: string) {
  return { data: { id }, error: null }
}

function errorResponse(name: string, message: string) {
  return { data: null, error: { name, message, statusCode: name === 'rate_limit_exceeded' ? 429 : 400 } }
}

let keyCounter = 0
function freshKey() {
  keyCounter += 1
  return `${MARKER}-key-${Date.now()}-${keyCounter}`
}

beforeEach(() => {
  sendMock.mockReset()
  capturedWork = null
  validateMarketingEmailConfigMock.mockReset()
  validateMarketingEmailConfigMock.mockReturnValue(null)
})

afterEach(() => {
  process.env.MARKETING_EMAIL_MAX_RECIPIENTS = ''
  process.env.MARKETING_EMAIL_SEND_RATE_PER_SECOND = '1000'
})

afterAll(async () => {
  await prisma.marketingCampaignRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } })
  await prisma.marketingCampaign.deleteMany({ where: { id: { in: campaignIds } } })
  await prisma.auditLog.deleteMany({ where: { entityId: { in: campaignIds } } })
  await prisma.subscriber.deleteMany({ where: { id: { in: subscriberIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.$disconnect()
})

process.env.MARKETING_EMAIL_SEND_RATE_PER_SECOND = '1000' // near-zero inter-send delay so tests run fast

describe('sendMarketingCampaignAction', () => {
  it('creates one campaign and one recipient row per subscriber, and sends each individually addressed from MARKETING_EMAIL_FROM', async () => {
    const a = await makeSubscriber()
    const b = await makeSubscriber()

    sendMock.mockResolvedValueOnce(successResponse('msg-a')).mockResolvedValueOnce(successResponse('msg-b'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id, b.subscriber.id] },
      content: { subject: 'Hello {{firstName}}', body: 'News from {{schoolName}}.' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    const campaignCount = await prisma.marketingCampaign.count({ where: { id: result.data.campaignId } })
    expect(campaignCount).toBe(1)
    const recipientRows = await prisma.marketingCampaignRecipient.findMany({ where: { campaignId: result.data.campaignId } })
    expect(recipientRows).toHaveLength(2)

    await capturedWork?.()

    expect(sendMock).toHaveBeenCalledTimes(2)
    for (const call of sendMock.mock.calls) {
      const payload = call[0] as Record<string, unknown>
      expect(typeof payload.to).toBe('string')
      expect(payload).not.toHaveProperty('cc')
      expect(payload).not.toHaveProperty('bcc')
      expect(payload.from).toBe(MARKETING_FROM)
      expect(payload.from).not.toBe(TRANSACTIONAL_FROM)
    }

    const finalCampaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(finalCampaign.sentCount).toBe(2)
    expect(finalCampaign.failedCount).toBe(0)
  })

  it('resolves every token before dispatch — no literal token survives into the sent message', async () => {
    const a = await makeSubscriber()

    sendMock.mockResolvedValueOnce(successResponse('msg-token'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Hi {{firstName}}', body: 'From {{schoolName}}, {{fullName}}.' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    const payload = sendMock.mock.calls[0]![0] as { subject: string; html: string; text: string }
    expect(payload.subject).not.toContain('{{')
    expect(payload.html).not.toContain('{{')
    expect(payload.text).not.toContain('{{')
    expect(payload.subject).toContain(a.teacher.fullName.split(' ')[0])
  })

  it('every sent message carries the recipient’s own unsubscribe link and List-Unsubscribe headers', async () => {
    const a = await makeSubscriber()
    sendMock.mockResolvedValueOnce(successResponse('msg-headers'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    const payload = sendMock.mock.calls[0]![0] as { html: string; text: string; headers: Record<string, string> }
    const token = (await prisma.subscriber.findUniqueOrThrow({ where: { id: a.subscriber.id } })).unsubscribeToken
    expect(payload.html).toContain(token)
    expect(payload.text).toContain(token)
    expect(payload.headers['List-Unsubscribe']).toContain(token)
    expect(payload.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('recipient resolution at send time re-applies the subscribed-only rule, excluding an unsubscribed contact even if named explicitly', async () => {
    const unsubscribed = await makeSubscriber({ status: 'UNSUBSCRIBED' })

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [unsubscribed.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('validation')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('a subscriber who unsubscribes mid-campaign is skipped, not sent to, and marked SKIPPED_UNSUBSCRIBED', async () => {
    const a = await makeSubscriber()

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    // Simulate the subscriber unsubscribing between manifest creation and dispatch.
    await prisma.subscriber.update({ where: { id: a.subscriber.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } })

    await capturedWork?.()

    expect(sendMock).not.toHaveBeenCalled()
    const recipient = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recipient.status).toBe('SKIPPED_UNSUBSCRIBED')
    const campaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.skippedCount).toBe(1)
    expect(campaign.sentCount).toBe(0)
    expect(campaign.failedCount).toBe(0)
  })

  it('aborts with a count mismatch and creates no campaign when the resolved count differs from the confirmed (typed) count', async () => {
    const a = await makeSubscriber()

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 5,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('count-mismatch')
    expect(sendMock).not.toHaveBeenCalled()
    expect(await prisma.marketingCampaignRecipient.count({ where: { subscriberId: a.subscriber.id } })).toBe(0)
  })

  it('rejects a subject containing a newline and creates no campaign (header-injection guard)', async () => {
    const a = await makeSubscriber()

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Line one\nBcc: evil@example.com', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('validation')
    expect(await prisma.marketingCampaignRecipient.count({ where: { subscriberId: a.subscriber.id } })).toBe(0)
  })

  it('blocks a send above the configurable safety limit, enforced server-side', async () => {
    const a = await makeSubscriber()
    const b = await makeSubscriber()
    const c = await makeSubscriber()

    process.env.MARKETING_EMAIL_MAX_RECIPIENTS = '2'

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id, b.subscriber.id, c.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 3,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('over-limit')
    expect(sendMock).not.toHaveBeenCalled()
    expect(await prisma.marketingCampaignRecipient.count({ where: { subscriberId: { in: [a.subscriber.id, b.subscriber.id, c.subscriber.id] } } })).toBe(0)
  })

  it('a double click with the same idempotency key produces one campaign, not two', async () => {
    const a = await makeSubscriber()
    sendMock.mockResolvedValue(successResponse('msg-double'))

    const key = freshKey()
    const input = {
      criteria: { mode: 'ids' as const, subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: key,
    }

    const [first, second] = await Promise.all([sendMarketingCampaignAction(input), sendMarketingCampaignAction(input)])

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(first.data.campaignId).toBe(second.data.campaignId)
    campaignIds.push(first.data.campaignId)

    const count = await prisma.marketingCampaignRecipient.count({ where: { subscriberId: a.subscriber.id, campaignId: first.data.campaignId } })
    expect(count).toBe(1)
  })

  it('a failed send does not stop the remaining queue, and records the failed error message', async () => {
    const a = await makeSubscriber()
    const b = await makeSubscriber()

    sendMock
      .mockResolvedValueOnce(errorResponse('invalid_parameter', 'Invalid recipient address.'))
      .mockResolvedValueOnce(successResponse('msg-ok'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id, b.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    expect(sendMock).toHaveBeenCalledTimes(2)
    const campaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(1)
    expect(campaign.failedCount).toBe(1)

    const failedRow = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId, status: 'FAILED' } })
    expect(failedRow.errorMessage).toBe('Invalid recipient address.')
    const sentRow = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId, status: 'SENT' } })
    expect(sentRow.providerMessageId).toBe('msg-ok')
  })

  it('never marks a recipient SENT without provider confirmation', async () => {
    const a = await makeSubscriber()
    sendMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    const recipient = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recipient.status).toBe('FAILED')
  })

  it('backs off and retries on a rate-limit response instead of failing the recipient', async () => {
    const a = await makeSubscriber()

    sendMock
      .mockResolvedValueOnce(errorResponse('rate_limit_exceeded', 'Too many requests.'))
      .mockResolvedValueOnce(successResponse('msg-after-backoff'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    expect(sendMock).toHaveBeenCalledTimes(2)
    const recipient = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recipient.status).toBe('SENT')
    expect(recipient.providerMessageId).toBe('msg-after-backoff')
  }, 10000)

  it('updates marketingEmailsSent and lastMarketingEmailAt only on a successful send', async () => {
    const sent = await makeSubscriber()
    const failed = await makeSubscriber()

    sendMock
      .mockResolvedValueOnce(successResponse('msg-count'))
      .mockResolvedValueOnce(errorResponse('invalid_parameter', 'Bounced.'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [sent.subscriber.id, failed.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    const sentSubscriber = await prisma.subscriber.findUniqueOrThrow({ where: { id: sent.subscriber.id } })
    expect(sentSubscriber.marketingEmailsSent).toBe(1)
    expect(sentSubscriber.lastMarketingEmailAt).not.toBeNull()

    const failedSubscriber = await prisma.subscriber.findUniqueOrThrow({ where: { id: failed.subscriber.id } })
    expect(failedSubscriber.marketingEmailsSent).toBe(0)
    expect(failedSubscriber.lastMarketingEmailAt).toBeNull()
  })
})

describe('retryFailedMarketingRecipientsAction', () => {
  it('re-sends only failures, never touches an already-delivered or skipped message, and updates the same campaign', async () => {
    const a = await makeSubscriber()
    const b = await makeSubscriber()

    sendMock
      .mockResolvedValueOnce(successResponse('msg-original'))
      .mockResolvedValueOnce(errorResponse('invalid_parameter', 'First attempt failed.'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id, b.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)
    await capturedWork?.()

    const sentBefore = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId, status: 'SENT' } })

    sendMock.mockResolvedValueOnce(successResponse('msg-retry'))
    const retryResult = await retryFailedMarketingRecipientsAction(result.data.campaignId)
    expect(retryResult.success).toBe(true)
    if (!retryResult.success) return
    expect(retryResult.data.retriedCount).toBe(1)

    await capturedWork?.()

    expect(await prisma.marketingCampaign.count({ where: { id: result.data.campaignId } })).toBe(1)

    const sentAfter = await prisma.marketingCampaignRecipient.findUniqueOrThrow({ where: { id: sentBefore.id } })
    expect(sentAfter.providerMessageId).toBe(sentBefore.providerMessageId)
    expect(sentAfter.sentAt?.getTime()).toBe(sentBefore.sentAt?.getTime())

    const campaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(2)
    expect(campaign.failedCount).toBe(0)
  })

  it('never retries a SKIPPED_UNSUBSCRIBED recipient', async () => {
    const a = await makeSubscriber()

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await prisma.subscriber.update({ where: { id: a.subscriber.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } })
    await capturedWork?.()

    const skippedRow = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(skippedRow.status).toBe('SKIPPED_UNSUBSCRIBED')

    const retryResult = await retryFailedMarketingRecipientsAction(result.data.campaignId)
    expect(retryResult.success).toBe(true)
    if (!retryResult.success) return
    expect(retryResult.data.retriedCount).toBe(0)

    const stillSkipped = await prisma.marketingCampaignRecipient.findUniqueOrThrow({ where: { id: skippedRow.id } })
    expect(stillSkipped.status).toBe('SKIPPED_UNSUBSCRIBED')
  })

  it('recovers rows stuck at PENDING from an aborted campaign once it looks orphaned, but leaves a still-fresh campaign alone', async () => {
    const a = await makeSubscriber()

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)
    // Deliberately never invoke capturedWork() — this is the exact shape of
    // the production incident: the queue never gets to run at all.

    const freshRetry = await retryFailedMarketingRecipientsAction(result.data.campaignId)
    expect(freshRetry.success).toBe(true)
    if (!freshRetry.success) return
    expect(freshRetry.data.retriedCount).toBe(0)
    const stillPending = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(stillPending.status).toBe('PENDING')

    // Simulate staleness: nothing about this campaign has changed in well over the orphan threshold.
    await prisma.marketingCampaign.update({
      where: { id: result.data.campaignId },
      data: { updatedAt: new Date(Date.now() - 11 * 60 * 1000) },
    })

    sendMock.mockResolvedValueOnce(successResponse('msg-recovered'))
    const staleRetry = await retryFailedMarketingRecipientsAction(result.data.campaignId)
    expect(staleRetry.success).toBe(true)
    if (!staleRetry.success) return
    expect(staleRetry.data.retriedCount).toBe(1)

    await capturedWork?.()

    const recovered = await prisma.marketingCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recovered.status).toBe('SENT')
    expect(recovered.providerMessageId).toBe('msg-recovered')
  })
})

describe('processMarketingCampaignSend hardening', () => {
  it('a throw on every recipient dispatch (a misconfigured MARKETING_EMAIL_FROM) marks each one FAILED individually, leaving none stuck at PENDING', async () => {
    const a = await makeSubscriber()
    const b = await makeSubscriber()
    const c = await makeSubscriber()

    // Reproduces the actual production incident: MARKETING_EMAIL_FROM
    // resolution throws before any Resend call, every time.
    sendMock.mockRejectedValue(new Error('MARKETING_EMAIL_FROM is not set on the server.'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id, b.subscriber.id, c.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 3,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    expect(sendMock).toHaveBeenCalledTimes(3)
    const rows = await prisma.marketingCampaignRecipient.findMany({ where: { campaignId: result.data.campaignId } })
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.status === 'FAILED')).toBe(true)
    expect(rows.every((row) => row.errorMessage === 'MARKETING_EMAIL_FROM is not set on the server.')).toBe(true)
    expect(rows.some((row) => row.status === 'PENDING')).toBe(false)

    const campaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(0)
    expect(campaign.failedCount).toBe(3)
  })

  it('a throw on the third of five recipients still leaves every recipient attempted, not abandoned', async () => {
    const subscribers = await Promise.all([1, 2, 3, 4, 5].map(() => makeSubscriber()))

    sendMock
      .mockResolvedValueOnce(successResponse('msg-1'))
      .mockResolvedValueOnce(successResponse('msg-2'))
      .mockRejectedValueOnce(new Error('Simulated crash on the third recipient.'))
      .mockResolvedValueOnce(successResponse('msg-4'))
      .mockResolvedValueOnce(successResponse('msg-5'))

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: subscribers.map((s) => s.subscriber.id) },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 5,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    // All five were attempted — the throw on the third never abandoned the rest.
    expect(sendMock).toHaveBeenCalledTimes(5)
    const rows = await prisma.marketingCampaignRecipient.findMany({ where: { campaignId: result.data.campaignId } })
    expect(rows.some((row) => row.status === 'PENDING')).toBe(false)
    expect(rows.filter((row) => row.status === 'SENT')).toHaveLength(4)
    const failedRows = rows.filter((row) => row.status === 'FAILED')
    expect(failedRows).toHaveLength(1)
    expect(failedRows[0]!.errorMessage).toBe('Simulated crash on the third recipient.')

    const campaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(4)
    expect(campaign.failedCount).toBe(1)
  })
})

describe('config validation gates campaign creation', () => {
  it('a missing MARKETING_EMAIL_FROM prevents campaign creation entirely, writing no rows, and names the variable', async () => {
    const a = await makeSubscriber()

    validateMarketingEmailConfigMock.mockReturnValue('MARKETING_EMAIL_FROM')

    const result = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('config')
    if (result.kind !== 'config') return
    expect(result.missing).toBe('MARKETING_EMAIL_FROM')
    expect(result.error).toContain('MARKETING_EMAIL_FROM')
    expect(sendMock).not.toHaveBeenCalled()
    expect(await prisma.marketingCampaignRecipient.count({ where: { subscriberId: a.subscriber.id } })).toBe(0)
  })
})

describe('getMarketingCampaignStatusAction', () => {
  it('reads the true state from the database', async () => {
    const a = await makeSubscriber()
    sendMock.mockResolvedValueOnce(successResponse('msg-status'))

    const sendResult = await sendMarketingCampaignAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(sendResult.success).toBe(true)
    if (!sendResult.success) return
    campaignIds.push(sendResult.data.campaignId)
    await capturedWork?.()

    const status = await getMarketingCampaignStatusAction(sendResult.data.campaignId)
    expect(status.success).toBe(true)
    if (!status.success) return
    expect(status.data.sentCount).toBe(1)
    expect(status.data.recipientCount).toBe(1)
    expect(status.data.recipients[0]?.status).toBe('SENT')
  })

  it('reports campaign not found for an unknown id', async () => {
    const status = await getMarketingCampaignStatusAction('does-not-exist')
    expect(status.success).toBe(false)
  })
})

describe('sendTestMarketingEmailAction', () => {
  it('sends one message from MARKETING_EMAIL_FROM and creates no campaign record', async () => {
    const a = await makeSubscriber()

    sendMock.mockResolvedValueOnce(successResponse('msg-test'))

    const result = await sendTestMarketingEmailAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Hi {{firstName}}', body: 'Body' },
      testAddress: 'admin-test@example.com',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.messageId).toBe('msg-test')

    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0]![0] as { to: string; subject: string; from: string }
    expect(payload.to).toBe('admin-test@example.com')
    expect(payload.from).toBe(MARKETING_FROM)
    expect(payload.subject).not.toContain('{{')

    expect(await prisma.marketingCampaignRecipient.count({ where: { subscriberId: a.subscriber.id } })).toBe(0)
    const subscriberAfter = await prisma.subscriber.findUniqueOrThrow({ where: { id: a.subscriber.id } })
    expect(subscriberAfter.marketingEmailsSent).toBe(0)
  })

  it('rejects a subject containing a newline', async () => {
    const a = await makeSubscriber()

    const result = await sendTestMarketingEmailAction({
      criteria: { mode: 'ids', subscriberIds: [a.subscriber.id] },
      content: { subject: 'Line one\nLine two', body: 'Body' },
      testAddress: 'admin-test@example.com',
    })

    expect(result.success).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
