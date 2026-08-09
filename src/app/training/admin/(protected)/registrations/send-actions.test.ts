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
vi.mock('@/lib/training/email/resend-client', () => ({
  getResendClient: () => ({ emails: { send: (...args: unknown[]) => sendMock(...args) } }),
  getEmailFrom: () => 'Edugistics Training <training@send.edugistics.online>',
  getEmailReplyTo: () => 'info@edugistics.online',
}))

const { sendCampaignAction, getCampaignStatusAction, retryFailedRecipientsAction, sendTestEmailAction } = await import('./send-actions')
const { prisma } = await import('@/lib/training/prisma')

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

process.env.EMAIL_SEND_RATE_PER_SECOND = '1000' // near-zero inter-send delay so tests run fast

describe('sendCampaignAction', () => {
  it('creates one campaign and one recipient row per unique teacher, and sends each individually addressed', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)

    sendMock.mockResolvedValueOnce(successResponse('msg-a')).mockResolvedValueOnce(successResponse('msg-b'))

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

    await capturedWork?.()

    expect(sendMock).toHaveBeenCalledTimes(2)
    for (const call of sendMock.mock.calls) {
      const payload = call[0] as Record<string, unknown>
      expect(typeof payload.to).toBe('string')
      expect(payload).not.toHaveProperty('cc')
      expect(payload).not.toHaveProperty('bcc')
    }

    const finalCampaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(finalCampaign.sentCount).toBe(2)
    expect(finalCampaign.failedCount).toBe(0)
  })

  it('resolves every token before dispatch — no literal token survives into the sent message', async () => {
    const course = await makeCourse({ name: 'Token Course' })
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    sendMock.mockResolvedValueOnce(successResponse('msg-token'))

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

    await capturedWork?.()

    const payload = sendMock.mock.calls[0]![0] as { subject: string; html: string; text: string }
    expect(payload.subject).not.toContain('{{')
    expect(payload.html).not.toContain('{{')
    expect(payload.text).not.toContain('{{')
    expect(payload.subject).toContain('Token Course')
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

    expect(sendMock).not.toHaveBeenCalled()
    const recipient = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId } })
    expect(recipient.status).toBe('FAILED')
    expect(recipient.errorMessage).toContain('no longer active')
  })

  it('aborts with a count mismatch and creates no campaign when the resolved count differs from the confirmed count', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    const before = await prisma.emailCampaign.count()

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
    expect(sendMock).not.toHaveBeenCalled()
    expect(await prisma.emailCampaign.count()).toBe(before)
  })

  it('rejects a subject containing a newline and creates no campaign (header-injection guard)', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)
    const before = await prisma.emailCampaign.count()

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
    expect(await prisma.emailCampaign.count()).toBe(before)
  })

  it('blocks a send above the configurable safety limit', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const teacherC = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)
    const regC = await makeRegistration(teacherC.id, course.id)
    const before = await prisma.emailCampaign.count()

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
    expect(sendMock).not.toHaveBeenCalled()
    expect(await prisma.emailCampaign.count()).toBe(before)
  })

  it('a double click with the same idempotency key produces one campaign, not two', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)
    sendMock.mockResolvedValue(successResponse('msg-double'))

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
    sendMock.mockResolvedValueOnce(successResponse('msg-first'))

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
    sendMock.mockResolvedValue(successResponse('msg-override'))

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

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: second.data.campaignId, action: 'EMAIL_CAMPAIGN_SENT' },
    })
    const after = auditRow.afterJson as { duplicateWarningOverridden: boolean; duplicateCount: number }
    expect(after.duplicateWarningOverridden).toBe(true)
    expect(after.duplicateCount).toBe(1)
  })

  it('a failed send does not stop the remaining queue, and records the failed error message', async () => {
    const course = await makeCourse()
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id)
    const regB = await makeRegistration(teacherB.id, course.id)

    sendMock
      .mockResolvedValueOnce(errorResponse('invalid_parameter', 'Invalid recipient address.'))
      .mockResolvedValueOnce(successResponse('msg-ok'))

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

    await capturedWork?.()

    expect(sendMock).toHaveBeenCalledTimes(2)
    const campaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(1)
    expect(campaign.failedCount).toBe(1)

    const failedRow = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId, status: 'FAILED' } })
    expect(failedRow.errorMessage).toBe('Invalid recipient address.')
    const sentRow = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId, status: 'SENT' } })
    expect(sentRow.providerMessageId).toBe('msg-ok')
  })

  it('never marks a recipient SENT without provider confirmation', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    sendMock.mockResolvedValueOnce({ data: null, error: null })

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

  it('backs off and retries on a rate-limit response instead of failing', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)

    sendMock
      .mockResolvedValueOnce(errorResponse('rate_limit_exceeded', 'Too many requests.'))
      .mockResolvedValueOnce(successResponse('msg-after-backoff'))

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

    expect(sendMock).toHaveBeenCalledTimes(2)
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

    sendMock
      .mockResolvedValueOnce(successResponse('msg-original'))
      .mockResolvedValueOnce(errorResponse('invalid_parameter', 'First attempt failed.'))

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
    await capturedWork?.()

    const sentBefore = await prisma.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId: result.data.campaignId, status: 'SENT' } })
    const campaignCountBefore = await prisma.emailCampaign.count()

    sendMock.mockResolvedValueOnce(successResponse('msg-retry'))
    const retryResult = await retryFailedRecipientsAction(result.data.campaignId)
    expect(retryResult.success).toBe(true)
    if (!retryResult.success) return
    expect(retryResult.data.retriedCount).toBe(1)

    await capturedWork?.()

    expect(await prisma.emailCampaign.count()).toBe(campaignCountBefore)

    const sentAfter = await prisma.emailCampaignRecipient.findUniqueOrThrow({ where: { id: sentBefore.id } })
    expect(sentAfter.providerMessageId).toBe(sentBefore.providerMessageId)
    expect(sentAfter.sentAt?.getTime()).toBe(sentBefore.sentAt?.getTime())

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: result.data.campaignId } })
    expect(campaign.sentCount).toBe(2)
    expect(campaign.failedCount).toBe(0)
  })
})

describe('getCampaignStatusAction', () => {
  it('reads the true state from the database', async () => {
    const course = await makeCourse()
    const teacher = await makeTeacher()
    const reg = await makeRegistration(teacher.id, course.id)
    sendMock.mockResolvedValueOnce(successResponse('msg-status'))

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
    const before = await prisma.emailCampaign.count()

    const result = await sendTestEmailAction({
      criteria: { mode: 'ids', registrationIds: [reg.id] },
      content: { subject: 'Reminder: {{courseName}}', body: 'Hi {{firstName}}' },
      testAddress: 'admin-test@example.com',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.messageId).toBe('msg-test')

    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0]![0] as { to: string; subject: string }
    expect(payload.to).toBe('admin-test@example.com')
    expect(payload.subject).not.toContain('{{')
    expect(payload.subject).toContain('Test Mode Course')

    expect(await prisma.emailCampaign.count()).toBe(before)
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
