import { afterAll, describe, expect, it } from 'vitest'

import {
  getCampaignDetail,
  getCampaignEmailSignalsForTeachers,
  getCommunicationSummary,
  getTeacherCommunicationHistory,
  listCampaignsForAdmin,
} from './campaign-analytics'
import { prisma } from '../prisma'

// Self-contained and self-cleaning, following the pattern already used by
// email-actions.test.ts / send-actions.test.ts. Hits the real database —
// every metric under test is a Postgres aggregate with no mockable boundary.
const MARKER = 'campaign-analytics-test'
const courseIds: string[] = []
const teacherIds: string[] = []
const registrationIds: string[] = []
const campaignIds: string[] = []

let courseCounter = 0
async function makeCourse(overrides: Partial<{ name: string }> = {}) {
  courseCounter += 1
  const course = await prisma.course.create({
    data: {
      name: overrides.name ?? `${MARKER} course ${courseCounter}`,
      slug: `${MARKER}-${Date.now()}-${courseCounter}-${Math.random().toString(36).slice(2)}`,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
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
      phone: `+2010002${teacherCounter}`,
      phoneNormalised: `+2010002${teacherCounter}`,
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

async function makeRegistration(teacherId: string, courseId: string, courseName: string, emailStatus: 'PENDING' | 'SENT' | 'FAILED' = 'SENT') {
  const registration = await prisma.registration.create({
    data: {
      reference: `${MARKER}-${teacherId}-${courseId}`,
      teacherId,
      courseId,
      courseNameSnapshot: courseName,
      courseDateSnapshot: new Date('2026-09-01T00:00:00.000Z'),
      courseFeeSnapshot: 0,
      courseCurrencySnapshot: 'EGP',
      status: 'CONFIRMED',
      emailType: 'CONFIRMED',
      emailStatus,
      emailSentAt: emailStatus === 'SENT' ? new Date() : null,
      emailError: emailStatus === 'FAILED' ? 'SMTP timeout' : null,
    },
  })
  registrationIds.push(registration.id)
  return registration
}

async function makeCampaign(
  courseId: string | null,
  overrides: Partial<{ subject: string; emailType: 'REMINDER' | 'ZOOM_LINK' | 'UPDATE' | 'CUSTOM'; createdAt: Date }> = {},
) {
  const campaign = await prisma.emailCampaign.create({
    data: {
      courseId,
      subject: overrides.subject ?? `${MARKER} subject`,
      bodyTemplate: 'Hi {{firstName}}, **bold** text.',
      emailType: overrides.emailType ?? 'CUSTOM',
      createdBy: 'admin',
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  })
  campaignIds.push(campaign.id)
  return campaign
}

async function makeRecipient(
  campaignId: string,
  teacherId: string,
  registrationId: string,
  status: 'PENDING' | 'SENT' | 'FAILED',
  overrides: Partial<{ errorMessage: string }> = {},
) {
  return prisma.emailCampaignRecipient.create({
    data: {
      campaignId,
      teacherId,
      registrationId,
      emailAddress: `${teacherId}@test.local`,
      status,
      sentAt: status === 'SENT' ? new Date() : null,
      errorMessage: status === 'FAILED' ? (overrides.errorMessage ?? 'Bounced') : null,
    },
  })
}

afterAll(async () => {
  await prisma.emailCampaignRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } })
  await prisma.emailCampaign.deleteMany({ where: { id: { in: campaignIds } } })
  await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('listCampaignsForAdmin', () => {
  it('reports the correct recipient/sent/failed counts and success rate for a single-course campaign', async () => {
    const course = await makeCourse({ name: 'Success Rate Course' })
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const teacherC = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id, course.name)
    const regB = await makeRegistration(teacherB.id, course.id, course.name)
    const regC = await makeRegistration(teacherC.id, course.id, course.name)

    const created = await makeCampaign(course.id, { subject: 'Rate check' })
    const campaign = await prisma.emailCampaign.update({
      where: { id: created.id },
      data: { recipientCount: 3, sentCount: 2, failedCount: 1 },
    })
    await makeRecipient(campaign.id, teacherA.id, regA.id, 'SENT')
    await makeRecipient(campaign.id, teacherB.id, regB.id, 'SENT')
    await makeRecipient(campaign.id, teacherC.id, regC.id, 'FAILED')

    const { rows } = await listCampaignsForAdmin({ courseId: course.id }, 0)
    const row = rows.find((r) => r.id === campaign.id)
    expect(row).toBeDefined()
    expect(row!.courseName).toBe('Success Rate Course')
    expect(row!.recipientCount).toBe(3)
    expect(row!.sentCount).toBe(2)
    expect(row!.failedCount).toBe(1)
    expect(row!.successRate).toBeCloseTo((2 / 3) * 100, 5)
  })

  it('shows "multiple courses" (null courseName) for a campaign with no single course', async () => {
    const campaign = await makeCampaign(null, { subject: 'Spans courses' })
    const { rows } = await listCampaignsForAdmin({}, 0)
    const row = rows.find((r) => r.id === campaign.id)
    expect(row?.courseId).toBeNull()
    expect(row?.courseName).toBeNull()
  })

  it('filters by course, email type and date consistently', async () => {
    const courseX = await makeCourse({ name: 'Filter Course X' })
    const courseY = await makeCourse({ name: 'Filter Course Y' })
    const campaignX = await makeCampaign(courseX.id, { subject: 'X reminder', emailType: 'REMINDER' })
    const campaignY = await makeCampaign(courseY.id, { subject: 'Y zoom', emailType: 'ZOOM_LINK' })

    const byCourse = await listCampaignsForAdmin({ courseId: courseX.id }, 0)
    expect(byCourse.rows.some((r) => r.id === campaignX.id)).toBe(true)
    expect(byCourse.rows.some((r) => r.id === campaignY.id)).toBe(false)

    const byType = await listCampaignsForAdmin({ emailType: 'ZOOM_LINK' }, 0)
    expect(byType.rows.some((r) => r.id === campaignY.id)).toBe(true)
    expect(byType.rows.some((r) => r.id === campaignX.id)).toBe(false)

    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const byDate = await listCampaignsForAdmin({ dateFrom: future }, 0)
    expect(byDate.rows.some((r) => r.id === campaignX.id || r.id === campaignY.id)).toBe(false)
  })

  it('never returns more than one page, even when far more campaigns exist', async () => {
    const many = await Promise.all(
      Array.from({ length: 30 }, (_, i) => makeCampaign(null, { subject: `${MARKER} pagination ${i}` })),
    )
    for (const c of many) campaignIds.push(c.id)

    const { rows, totalCount } = await listCampaignsForAdmin({}, 0)
    expect(rows.length).toBeLessThanOrEqual(25)
    expect(totalCount).toBeGreaterThanOrEqual(30)
  })
})

describe('getCampaignDetail', () => {
  it('returns every recipient with the correct status and a matching success rate', async () => {
    const course = await makeCourse({ name: 'Detail Course' })
    const teacherA = await makeTeacher()
    const teacherB = await makeTeacher()
    const regA = await makeRegistration(teacherA.id, course.id, course.name)
    const regB = await makeRegistration(teacherB.id, course.id, course.name)
    const campaign = await makeCampaign(course.id, { subject: '**Bold** detail subject' })
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { recipientCount: 2, sentCount: 1, failedCount: 1 } })
    await makeRecipient(campaign.id, teacherA.id, regA.id, 'SENT')
    await makeRecipient(campaign.id, teacherB.id, regB.id, 'FAILED', { errorMessage: 'Invalid address' })

    const detail = await getCampaignDetail(campaign.id)
    expect(detail).not.toBeNull()
    expect(detail!.recipients).toHaveLength(2)
    const sent = detail!.recipients.find((r) => r.status === 'SENT')
    const failed = detail!.recipients.find((r) => r.status === 'FAILED')
    expect(sent?.teacherName).toBe(teacherA.fullName)
    expect(failed?.teacherName).toBe(teacherB.fullName)
    expect(failed?.errorMessage).toBe('Invalid address')
    expect(detail!.successRate).toBeCloseTo(50, 5)
    // renderCampaignBodyHtml only applies markdown-lite formatting — tokens stay
    // literal here (there is no single recipient to resolve them against); that
    // resolution happens per-recipient at send time, not in this admin-facing view.
    expect(detail!.renderedBodyHtml).toContain('{{firstName}}')
    expect(detail!.renderedBodyHtml).toContain('<strong>bold</strong>')
  })

  it('returns null for an unknown campaign id', async () => {
    expect(await getCampaignDetail('does-not-exist')).toBeNull()
  })
})

describe('getCommunicationSummary', () => {
  it('matches the underlying campaign and recipient records exactly', async () => {
    const courseA = await makeCourse({ name: 'Summary Course A' })
    const courseB = await makeCourse({ name: 'Summary Course B' })
    const teacher1 = await makeTeacher()
    const teacher2 = await makeTeacher()
    const reg1 = await makeRegistration(teacher1.id, courseA.id, courseA.name)
    const reg2 = await makeRegistration(teacher2.id, courseB.id, courseB.name)

    const campaign1 = await makeCampaign(courseA.id, { subject: 'Summary campaign 1' })
    await prisma.emailCampaign.update({ where: { id: campaign1.id }, data: { recipientCount: 1, sentCount: 1, failedCount: 0 } })
    await makeRecipient(campaign1.id, teacher1.id, reg1.id, 'SENT')

    const campaign2 = await makeCampaign(courseB.id, { subject: 'Summary campaign 2' })
    await prisma.emailCampaign.update({ where: { id: campaign2.id }, data: { recipientCount: 1, sentCount: 0, failedCount: 1 } })
    await makeRecipient(campaign2.id, teacher2.id, reg2.id, 'FAILED')

    // Scoping by courseId isolates exactly campaign1 (courseA) from campaign2 (courseB) and everything else in the database.
    const scoped = await getCommunicationSummary({ courseId: courseA.id })
    expect(scoped.totalCampaignEmails).toBe(1)
    expect(scoped.totalSuccessful).toBe(1)
    expect(scoped.totalFailed).toBe(0)
    expect(scoped.successRate).toBe(100)
    expect(scoped.distinctCoursesCommunicated).toBe(1)
    expect(scoped.distinctTeachersContacted).toBe(1)
  })
})

describe('getTeacherCommunicationHistory', () => {
  it('includes both the registration email and the campaign email, correctly labelled', async () => {
    const course = await makeCourse({ name: 'History Course' })
    const teacher = await makeTeacher()
    const registration = await makeRegistration(teacher.id, course.id, course.name, 'SENT')
    const campaign = await makeCampaign(course.id, { subject: 'History campaign subject', emailType: 'UPDATE' })
    await makeRecipient(campaign.id, teacher.id, registration.id, 'SENT')

    const history = await getTeacherCommunicationHistory(teacher.id)
    expect(history.length).toBeGreaterThanOrEqual(2)

    const registrationItem = history.find((item) => item.source === 'REGISTRATION')
    const campaignItem = history.find((item) => item.source === 'CAMPAIGN')
    expect(registrationItem).toBeDefined()
    expect(campaignItem).toBeDefined()
    expect(registrationItem?.subject).toBe('Registration confirmed')
    expect(campaignItem?.subject).toBe('History campaign subject')
    expect(campaignItem?.status).toBe('SENT')
  })
})

describe('getCampaignEmailSignalsForTeachers', () => {
  it('counts only SENT campaign emails and reports the latest sentAt', async () => {
    const course = await makeCourse({ name: 'Signal Course' })
    const teacher = await makeTeacher()
    const registration = await makeRegistration(teacher.id, course.id, course.name)
    const campaign1 = await makeCampaign(course.id, { subject: 'Signal 1' })
    const campaign2 = await makeCampaign(course.id, { subject: 'Signal 2' })
    await makeRecipient(campaign1.id, teacher.id, registration.id, 'SENT')
    await makeRecipient(campaign2.id, teacher.id, registration.id, 'PENDING')

    const signals = await getCampaignEmailSignalsForTeachers([teacher.id])
    expect(signals.get(teacher.id)?.count).toBe(1)
    expect(signals.get(teacher.id)?.lastSentAt).not.toBeNull()
  })
})
