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

// sendMock backs the single-send path (resend.emails.send) — still used
// as-is by dispatchTestEmail ("Send Test to Myself"), which was never
// batched. batchSendMock backs resend.batch.send — what processCampaignSend
// now calls for every real campaign send, in batches of up to BATCH_SIZE
// (see batch-send.ts). Both need mocking on the same client.
const sendMock = vi.fn()
const batchSendMock = vi.fn()
const validateBulkEmailConfigMock = vi.fn<() => string | null>(() => null)
vi.mock('@/lib/training/email/resend-client', () => ({
  getResendClient: () => ({
    emails: { send: (...args: unknown[]) => sendMock(...args) },
    batch: { send: (...args: unknown[]) => batchSendMock(...args) },
  }),
  getEmailFrom: () => 'Edugistics Training <training@send.edugistics.online>',
  getEmailReplyTo: () => 'info@edugistics.online',
  validateBulkEmailConfig: () => validateBulkEmailConfigMock(),
}))

// Wraps the real resolveRecipients so every existing test keeps hitting the
// actual database-backed resolution logic unchanged — only a test that
// explicitly calls .mockRejectedValueOnce()/.mockImplementationOnce() on it
// diverges, and only for its one call, falling straight back to the real
// implementation afterwards. Used to exercise processCampaignSend's outer
// try/catch (the queue-abort sweep), which nothing else in this file can
// reach without a throw from somewhere before the per-batch loop.
vi.mock('@/lib/training/email/recipients', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/training/email/recipients')>()
  return { ...actual, resolveRecipients: vi.fn(actual.resolveRecipients) }
})

const { sendCampaignAction, getCampaignStatusAction, retryFailedRecipientsAction, sendTestEmailAction } = await import('./send-actions')
const { prisma } = await import('@/lib/training/prisma')
const { resolveRecipients } = await import('@/lib/training/email/recipients')

// Self-contained and self-cleaning, following the pattern in email-actions.test.ts.
// Hits the real database; only the Resend network boundary is mocked.
const MARKER = 'send-actions-test'
const courseIds: string[] = []
const teacherIds: string[] = []
const registrationIds: string[] = []
const campaignIds: string[] = []

let slugCounter = 0
async function makeCourse(overrides: Partial<{ name: string; zoomLink: string | null }> = {}) {
  slugCounter += 1
  const course = await prisma.course.create({
    data: {
      name: overrides.name ?? `${MARKER} course ${slugCounter}`,
      slug: `${MARKER}-${Date.now()}-${slugCounter}-${Math.random().toString(36).slice(2)}`,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      zoomLink: overrides.zoomLink ?? null,
    },
  })
  courseIds.push(course.id)
  return course
}

let teacherCounter = 0
async function makeTeacher() {
  teacherCounter += 1
  const email = `${MARKER}-${Date.now()}-${teacherCounter}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${teacherCounter}`,
      phone: `+2010001${teacherCounter}`,
      phoneNormalised: `+2010001${teacherCounter}`,
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
  return teacher
}

async function makeRegistration(teacherId: string, courseId: string, status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' = 'CONFIRMED') {
  const registration = await prisma.registration.create({
    data: {
      reference: `${MARKER}-${teacherId}-${courseId}`,
      teacherId,
      courseId,
      courseNameSnapshot: 'x',
      courseDateSnapshot: new Date('2026-09-01T00:00:00.000Z'),
      courseFeeSnapshot: 0,
      courseCurrencySnapshot: 'EGP',
      status,
      emailType: status === 'WAITLISTED' ? 'WAITLISTED' : 'CONFIRMED',
    },
  })
  registrationIds.push(registration.id)
  return registration
}

function successResponse(id: string) {
  return { data: { id }, error: null }
}

/** A successful resend.batch.send response — every recipient in the call accepted, in order. */
function batchSuccessResponse(ids: string[]) {
  return { data: { data: ids.map((id) => ({ id })), errors: [] }, error: null }
}

/**
 * A permissive-mode resend.batch.send response mixing accepted and rejected
 * recipients. `errors[].index` is the position in the *original* call
 * payload — see mapBatchResponseToOutcomes (batch-send.ts) for how that's
 * reconciled back onto the right recipient.
 */
function batchPartialResponse(dataIds: string[], errors: { index: number; message: string }[]) {
  return { data: { data: dataIds.map((id) => ({ id })), errors }, error: null }
}

/** The whole batch call rejected outright — no per-recipient breakdown available. */
function batchErrorResponse(name: string, message: string) {
  return { data: null, error: { name, message, statusCode: name === 'rate_limit_exceeded' ? 429 : 400 } }
}

let keyCounter = 0
function freshKey() {
  keyCounter += 1
  return `${MARKER}-key-${Date.now()}-${keyCounter}`
}

beforeEach(() => {
  sendMock.mockReset()
  batchSendMock.mockReset()
  capturedWork = null
  validateBulkEmailConfigMock.mockReset()
  validateBulkEmailConfigMock.mockReturnValue(null)
  vi.mocked(resolveRecipients).mockClear()
})

afterEach(() => {
  process.env.BULK_EMAIL_MAX_RECIPIENTS = ''
  process.env.EMAIL_SEND_RATE_PER_SECOND = '1000'
})

afterAll(async () => {
  await prisma.emailCampaignRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } })
  await prisma.emailCampaign.deleteMany({ where: { id: { in: campaignIds } } })
  await prisma.auditLog.deleteMany({ where: { entityId: { in: campaignIds } } })
  await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

process.env.EMAIL_SEND_RATE_PER_SECOND = '1000' // near-zero inter-batch delay so tests run fast

describe('sendCampaignAction', () => {
  it('creates one campaign and one recipient row per unique teacher, and sends every recipient in one batch call, each individually addressed', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [regA.id, regB.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Hello {{firstName}}', body: 'See you at {{courseName}}.' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    const campaignCount = await prisma.emailCampaign.count({ where: { id: result.data.campaignId } })
    expect(campaignCount).toBe(1)
    const recipientRows = await prisma.emailCampaignRecipient.findMany({ where: { campaignId: result.data.campaignId } })
    expect(recipientRows).toHaveLength(2)

    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-a', 'msg-b']))

    await capturedWork?.()

    // Both recipients fit in one batch call (well under BATCH_SIZE) —
    // that's the whole point of batching, and what fixed defect 1.
    expect(batchSendMock).toHaveBeenCalledTimes(1)
    const payload = batchSendMock.mock.calls[0]![0] as Record<string, unknown>[]
    expect(payload).toHaveLength(2)
    for (const message of payload) {
      expect(typeof message.to).toBe('string')
      expect(message).not.toHaveProperty('cc')
      expect(message).not.toHaveProperty('bcc')
    }

    const finalCampaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(finalCampaign.sentCount).toBe(2)
    expect(finalCampaign.failedCount).toBe(0)
  })

  it('resolves every token before dispatch — no literal token survives into the sent message', async () => {
    const course = await makeCourse({ name: 'Token Course' })
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Reminder: {{courseName}}', body: 'Hi {{firstName}}, see {{courseName}} on {{courseDate}}.' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-token']))

    await capturedWork?.()

    const payload = batchSendMock.mock.calls[0]![0] as { subject: string; html: string; text: string }[]
    expect(payload[0]!.subject).not.toContain('{{')
    expect(payload[0]!.html).not.toContain('{{')
    expect(payload[0]!.text).not.toContain('{{')
    expect(payload[0]!.subject).toContain('Token Course')
  })

  it('re-applies exclusions at send time: a registration cancelled after queueing is failed, not sent', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    // Simulate the teacher cancelling between manifest creation and dispatch.
    await prisma.registration.update({ where: { id: reg.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })

    await capturedWork?.()

    // Nothing left to dispatch once the only recipient is excluded — no
    // batch call is even made (dispatchBatch short-circuits on an empty list).
    expect(batchSendMock).not.toHaveBeenCalled()
    const recipient = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recipient.status).toBe('FAILED')
    expect(recipient.errorMessage).toContain('no longer active')
  })

  it('aborts with a count mismatch and creates no campaign when the resolved count differs from the confirmed count', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 5,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('count-mismatch')
    expect(batchSendMock).not.toHaveBeenCalled()
    // Scoped to this test's own course — an unfiltered global count races with other
    // test files creating/deleting campaigns concurrently against the same database.
    expect(await prisma.emailCampaign.count({ where: { courseId: course.id } })).toBe(0)
  })

  it('rejects a subject containing a newline and creates no campaign (header-injection guard)', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Line one\nBcc: evil@example.com', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('validation')
    expect(await prisma.emailCampaign.count({ where: { courseId: course.id } })).toBe(0)
  })

  it('blocks a send above the configurable safety limit', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const teacherC = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)
    const regC = await makeRegistration(teacherC.id, course.id)

    process.env.BULK_EMAIL_MAX_RECIPIENTS = '2'

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [regA.id, regB.id, regC.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 3,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('over-limit')
    expect(batchSendMock).not.toHaveBeenCalled()
    expect(await prisma.emailCampaign.count({ where: { courseId: course.id } })).toBe(0)
  })

  it('a double click with the same idempotency key produces one campaign, not two', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const key = freshKey()
    const input = {
      criteria: { mode: 'ids' as const, registrationIds: [reg.id] },
      emailType: 'CUSTOM' as const,
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: key,
    }

    const [first, second] = await Promise.all([sendCampaignAction(input), sendCampaignAction(input)])

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(first.data.campaignId).toBe(second.data.campaignId)
    campaignIds.push(first.data.campaignId)

    const count = await prisma.emailCampaignRecipient.count({ where: { registrationId: reg.id, campaignId: first.data.campaignId } })
    expect(count).toBe(1)
  })

  it('warns of a recent duplicate for the same emailType and course, and blocks by default', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const first = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'ZOOM_LINK',
      content: { subject: 'Zoom', body: 'Join us: {{zoomLink}}' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    campaignIds.push(first.data.campaignId)

    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-first']))
    await capturedWork?.()

    const second = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'ZOOM_LINK',
      content: { subject: 'Zoom again', body: 'Join us: {{zoomLink}}' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })

    expect(second.success).toBe(false)
    if (second.success) return
    expect(second.kind).toBe('duplicates')
    if (second.kind !== 'duplicates') return
    expect(second.duplicateCount).toBe(1)
    expect(second.totalCount).toBe(1)
  })

  it('Send Anyway proceeds past the duplicate warning and records the override in the audit log', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const first = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'REMINDER',
      content: { subject: 'Reminder', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    campaignIds.push(first.data.campaignId)
    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-override-1']))
    await capturedWork?.()

    const overrideKey = freshKey()
    const second = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'REMINDER',
      content: { subject: 'Reminder again', body: 'Body' },
      confirmedCount: 1,
      overrideDuplicates: true,
      idempotencyKey: overrideKey,
    })

    expect(second.success).toBe(true)
    if (!second.success) return
    campaignIds.push(second.data.campaignId)
    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-override-2']))
    await capturedWork?.()

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: second.data.campaignId, action: 'EMAIL_CAMPAIGN_SENT' },
    })
    const after = auditRow.afterJson as { duplicateWarningOverridden: boolean; duplicateCount: number }
    expect(after.duplicateWarningOverridden).toBe(true)
    expect(after.duplicateCount).toBe(1)
  })

  it('a failed recipient within a batch does not stop the rest of that batch, and records the failure reason', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [regA.id, regB.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    // Both recipients land in the same batch call — query the actual
    // PENDING order (the same order processOneBatch will build the batch
    // payload in) rather than assuming which teacher's row comes first.
    const pendingRows = await prisma.emailCampaignRecipient.findMany({
      where: { campaignId: result.data.campaignId },
      orderBy: { createdAt: 'asc' },
    })
    expect(pendingRows).toHaveLength(2)

    // Resend's batchValidation:'permissive' response: index 0 rejected,
    // index 1 accepted — one bad recipient doesn't block the other.
    batchSendMock.mockResolvedValueOnce(batchPartialResponse(['msg-ok'], [{ index: 0, message: 'Invalid recipient address.' }]))

    await capturedWork?.()

    expect(batchSendMock).toHaveBeenCalledTimes(1)
    const campaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(1)
    expect(campaign.failedCount).toBe(1)

    const failedRow = await prisma.emailCampaignRecipient.findUniqueOrThrow({ where: { id: pendingRows[0]!.id } })
    expect(failedRow.status).toBe('FAILED')
    expect(failedRow.errorMessage).toBe('Invalid recipient address.')
    const sentRow = await prisma.emailCampaignRecipient.findUniqueOrThrow({ where: { id: pendingRows[1]!.id } })
    expect(sentRow.status).toBe('SENT')
    expect(sentRow.providerMessageId).toBe('msg-ok')
  })

  it('never marks a recipient SENT without provider confirmation', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    // A malformed response — neither a result nor an error. dispatchBatch
    // treats this the same as any other failure: every recipient in the
    // call is failed with a generic reason, never silently marked SENT.
    batchSendMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    const recipient = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recipient.status).toBe('FAILED')
  })

  it('backs off and retries the whole batch on a rate-limit response instead of failing', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    batchSendMock
      .mockResolvedValueOnce(batchErrorResponse('rate_limit_exceeded', 'Too many requests.'))
      .mockResolvedValueOnce(batchSuccessResponse(['msg-after-backoff']))

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    expect(batchSendMock).toHaveBeenCalledTimes(2)
    const recipient = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recipient.status).toBe('SENT')
    expect(recipient.providerMessageId).toBe('msg-after-backoff')
  }, 10000)
})

describe('retryFailedRecipientsAction', () => {
  it('re-sends only failures, never touches an already-delivered message, and updates the same campaign', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [regA.id, regB.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    const pendingRows = await prisma.emailCampaignRecipient.findMany({
      where: { campaignId: result.data.campaignId },
      orderBy: { createdAt: 'asc' },
    })
    batchSendMock.mockResolvedValueOnce(
      batchPartialResponse(['msg-original'], [{ index: 1, message: 'First attempt failed.' }]),
    )
    await capturedWork?.()

    const sentBefore = await prisma.emailCampaignRecipient.findUniqueOrThrow({ where: { id: pendingRows[0]!.id } })
    expect(sentBefore.status).toBe('SENT')

    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-retry']))
    const retryResult = await retryFailedRecipientsAction(result.data.campaignId)
    expect(retryResult.success).toBe(true)
    if (!retryResult.success) return
    expect(retryResult.data.retriedCount).toBe(1)

    await capturedWork?.()

    // Scoped to this test's own course — retry must not have created a second campaign row.
    expect(await prisma.emailCampaign.count({ where: { courseId: course.id } })).toBe(1)

    const sentAfter = await prisma.emailCampaignRecipient.findUniqueOrThrow({ where: { id: sentBefore.id } })
    expect(sentAfter.providerMessageId).toBe(sentBefore.providerMessageId)
    expect(sentAfter.sentAt?.getTime()).toBe(sentBefore.sentAt?.getTime())

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(2)
    expect(campaign.failedCount).toBe(0)
  })

  it('recovers rows stuck at PENDING from an aborted campaign once it looks orphaned, but leaves a still-fresh campaign alone', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)
    // Deliberately never invoke capturedWork() — simulates the queue never
    // having run at all (e.g. the function was killed before after() fired).

    const freshRetry = await retryFailedRecipientsAction(result.data.campaignId)
    expect(freshRetry.success).toBe(true)
    if (!freshRetry.success) return
    expect(freshRetry.data.retriedCount).toBe(0)
    const stillPending = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(stillPending.status).toBe('PENDING')

    // Simulate staleness: nothing about this campaign has changed in well over the orphan threshold.
    await prisma.emailCampaign.update({
      where: { id: result.data.campaignId },
      data: { updatedAt: new Date(Date.now() - 11 * 60 * 1000) },
    })

    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-recovered']))
    const staleRetry = await retryFailedRecipientsAction(result.data.campaignId)
    expect(staleRetry.success).toBe(true)
    if (!staleRetry.success) return
    expect(staleRetry.data.retriedCount).toBe(1)

    await capturedWork?.()

    const recovered = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recovered.status).toBe('SENT')
    expect(recovered.providerMessageId).toBe('msg-recovered')
  })
})

describe('processCampaignSend hardening', () => {
  it('a batch call that throws outright marks every recipient in it FAILED, leaving none stuck at PENDING', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const teacherC = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)
    const regC = await makeRegistration(teacherC.id, course.id)

    // Reproduces the production incident: the sender-resolution throws
    // before any Resend call, every time — the exact behaviour of a
    // misconfigured EMAIL_FROM. All three recipients fit in one batch call
    // (well under BATCH_SIZE), so this is one rejected call, not three.
    batchSendMock.mockRejectedValue(new Error('EMAIL_FROM is not set on the server.'))

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [regA.id, regB.id, regC.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 3,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    await capturedWork?.()

    expect(batchSendMock).toHaveBeenCalledTimes(1)
    const rows = await prisma.emailCampaignRecipient.findMany({ where: { campaignId: result.data.campaignId } })
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.status === 'FAILED')).toBe(true)
    expect(rows.every((row) => row.errorMessage === 'EMAIL_FROM is not set on the server.')).toBe(true)
    expect(rows.some((row) => row.status === 'PENDING')).toBe(false)

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(0)
    expect(campaign.failedCount).toBe(3)
  })

  it('one rejected recipient among five still leaves every recipient attempted, not abandoned', async () => {
    const course = await makeCourse()
    const teachers = await Promise.all([1, 2, 3, 4, 5].map(() => makeTeacher()))
    const regs = await Promise.all(teachers.map((t) => makeRegistration(t.id, course.id)))

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: regs.map((r) => r.id) },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 5,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    // All five land in one batch call — the third is rejected by Resend's
    // permissive validation, the other four succeed alongside it.
    batchSendMock.mockResolvedValueOnce(
      batchPartialResponse(
        ['msg-1', 'msg-2', 'msg-4', 'msg-5'],
        [{ index: 2, message: 'Simulated rejection on the third recipient.' }],
      ),
    )

    await capturedWork?.()

    // All five were attempted in that one call — the rejection on the third never abandoned the rest.
    expect(batchSendMock).toHaveBeenCalledTimes(1)
    const rows = await prisma.emailCampaignRecipient.findMany({ where: { campaignId: result.data.campaignId } })
    expect(rows.some((row) => row.status === 'PENDING')).toBe(false)
    expect(rows.filter((row) => row.status === 'SENT')).toHaveLength(4)
    const failedRows = rows.filter((row) => row.status === 'FAILED')
    expect(failedRows).toHaveLength(1)
    expect(failedRows[0]!.errorMessage).toBe('Simulated rejection on the third recipient.')

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(4)
    expect(campaign.failedCount).toBe(1)
  })

  it('a throw before any recipient is reached (recipient resolution itself failing) marks every queued recipient FAILED with an abort reason', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [regA.id, regB.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 2,
      idempotencyKey: freshKey(),
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    campaignIds.push(result.data.campaignId)

    // Simulates a failure that has nothing to do with any single recipient —
    // e.g. a lost database connection — happening before the per-batch loop
    // even starts. This is what the outer try/catch in processCampaignSend
    // exists to catch; nothing about this reaches the per-batch try/catch at all.
    vi.mocked(resolveRecipients).mockRejectedValueOnce(new Error('Connection to the database was lost.'))

    await capturedWork?.()

    expect(batchSendMock).not.toHaveBeenCalled()
    const rows = await prisma.emailCampaignRecipient.findMany({ where: { campaignId: result.data.campaignId } })
    expect(rows.every((row) => row.status === 'FAILED')).toBe(true)
    expect(rows.every((row) => row.errorMessage?.includes('Sending queue aborted'))).toBe(true)
    expect(rows.every((row) => row.errorMessage?.includes('Connection to the database was lost.'))).toBe(true)

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.failedCount).toBe(2)
  })
})

describe('config validation gates campaign creation', () => {
  it('a missing EMAIL_FROM prevents campaign creation entirely, writing no rows, and names the variable', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    validateBulkEmailConfigMock.mockReturnValue('EMAIL_FROM')

    const result = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.kind).toBe('config')
    if (result.kind !== 'config') return
    expect(result.missing).toBe('EMAIL_FROM')
    expect(result.error).toContain('EMAIL_FROM')
    expect(batchSendMock).not.toHaveBeenCalled()
    expect(await prisma.emailCampaign.count({ where: { courseId: course.id } })).toBe(0)
    expect(await prisma.emailCampaignRecipient.count({ where: { registrationId: reg.id } })).toBe(0)
  })
})

describe('getCampaignStatusAction', () => {
  it('reads the true state from the database', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const sendResult = await sendCampaignAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      emailType: 'CUSTOM',
      content: { subject: 'Subject', body: 'Body' },
      confirmedCount: 1,
      idempotencyKey: freshKey(),
    })
    expect(sendResult.success).toBe(true)
    if (!sendResult.success) return
    campaignIds.push(sendResult.data.campaignId)
    batchSendMock.mockResolvedValueOnce(batchSuccessResponse(['msg-status']))
    await capturedWork?.()

    const status = await getCampaignStatusAction(sendResult.data.campaignId)
    expect(status.success).toBe(true)
    if (!status.success) return
    expect(status.data.sentCount).toBe(1)
    expect(status.data.recipientCount).toBe(1)
    expect(status.data.recipients[0]?.status).toBe('SENT')
  })

  it('reports campaign not found for an unknown id', async () => {
    const status = await getCampaignStatusAction('does-not-exist')
    expect(status.success).toBe(false)
  })
})

describe('sendTestEmailAction', () => {
  it('sends one message and creates no campaign record', async () => {
    const course = await makeCourse({ name: 'Test Mode Course' })
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    sendMock.mockResolvedValueOnce(successResponse('msg-test'))

    const result = await sendTestEmailAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      content: { subject: 'Reminder: {{courseName}}', body: 'Hi {{firstName}}' },
      testAddress: 'admin-test@example.com',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.messageId).toBe('msg-test')

    // "Send Test to Myself" was never part of defect 1/5's batching — it's
    // a single, immediate send (dispatchTestEmail), so it still goes
    // through resend.emails.send, not resend.batch.send.
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(batchSendMock).not.toHaveBeenCalled()
    const payload = sendMock.mock.calls[0]![0] as { to: string; subject: string }
    expect(payload.to).toBe('admin-test@example.com')
    expect(payload.subject).not.toContain('{{')
    expect(payload.subject).toContain('Test Mode Course')

    expect(await prisma.emailCampaign.count({ where: { courseId: course.id } })).toBe(0)
  })

  it('rejects a subject containing a newline', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const result = await sendTestEmailAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      content: { subject: 'Line one\nLine two', body: 'Body' },
      testAddress: 'admin-test@example.com',
    })

    expect(result.success).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
