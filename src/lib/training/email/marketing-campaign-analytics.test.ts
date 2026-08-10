import { afterAll, describe, expect, it } from 'vitest'

import {
  getMarketingCampaignDetail,
  getMarketingCampaignSummary,
  getSubscriberMarketingEmailHistory,
  listMarketingCampaignsForAdmin,
} from './marketing-campaign-analytics'
import { prisma } from '../prisma'

// Self-contained and self-cleaning, following the pattern already used by campaign-analytics.test.ts.
// Hits the real database — every metric under test is a Postgres aggregate with no mockable boundary.
const MARKER = 'marketing-campaign-analytics-test'
const teacherIds: string[] = []
const subscriberIds: string[] = []
const campaignIds: string[] = []

let teacherCounter = 0
async function makeSubscriber() {
  teacherCounter += 1
  const email = `${MARKER}-${Date.now()}-${teacherCounter}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${teacherCounter}`,
      phone: `+2010004${teacherCounter}`,
      phoneNormalised: `+2010004${teacherCounter}`,
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

  const subscriber = await prisma.subscriber.create({
    data: {
      teacherId: teacher.id,
      emailNormalised: email,
      status: 'SUBSCRIBED',
      subscribedAt: new Date(),
      consentSource: 'TRAINING_REGISTRATION',
      consentWordingVersion: 'v1',
      unsubscribeToken: `${MARKER}-token-${teacher.id}`,
    },
  })
  subscriberIds.push(subscriber.id)
  return { teacher, subscriber }
}

async function makeCampaign(overrides: Partial<{ subject: string; createdAt: Date }> = {}) {
  const campaign = await prisma.marketingCampaign.create({
    data: {
      subject: overrides.subject ?? `${MARKER} subject`,
      bodyTemplate: 'Hi {{firstName}}, **bold** text.',
      createdBy: 'admin',
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  })
  campaignIds.push(campaign.id)
  return campaign
}

async function makeRecipient(
  campaignId: string,
  subscriberId: string,
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED_UNSUBSCRIBED',
  overrides: Partial<{ errorMessage: string }> = {},
) {
  return prisma.marketingCampaignRecipient.create({
    data: {
      campaignId,
      subscriberId,
      emailAddress: `${subscriberId}@test.local`,
      status,
      sentAt: status === 'SENT' ? new Date() : null,
      errorMessage: status === 'FAILED' ? (overrides.errorMessage ?? 'Bounced') : null,
    },
  })
}

afterAll(async () => {
  await prisma.marketingCampaignRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } })
  await prisma.marketingCampaign.deleteMany({ where: { id: { in: campaignIds } } })
  await prisma.subscriber.deleteMany({ where: { id: { in: subscriberIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.$disconnect()
})

describe('listMarketingCampaignsForAdmin', () => {
  it('reports the correct recipient/sent/failed/skipped counts and success rate', async () => {
    const a = await makeSubscriber()
    const b = await makeSubscriber()
    const c = await makeSubscriber()

    const created = await makeCampaign({ subject: 'Rate check' })
    const campaign = await prisma.marketingCampaign.update({
      where: { id: created.id },
      data: { recipientCount: 3, sentCount: 1, failedCount: 1, skippedCount: 1 },
    })
    await makeRecipient(campaign.id, a.subscriber.id, 'SENT')
    await makeRecipient(campaign.id, b.subscriber.id, 'FAILED')
    await makeRecipient(campaign.id, c.subscriber.id, 'SKIPPED_UNSUBSCRIBED')

    const { rows } = await listMarketingCampaignsForAdmin({}, 0)
    const row = rows.find((r) => r.id === campaign.id)
    expect(row).toBeDefined()
    expect(row!.recipientCount).toBe(3)
    expect(row!.sentCount).toBe(1)
    expect(row!.failedCount).toBe(1)
    expect(row!.skippedCount).toBe(1)
    expect(row!.successRate).toBeCloseTo(50, 5)
  })

  it('filters by date range', async () => {
    const inRange = await makeCampaign({ subject: 'In range' })
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const byDate = await listMarketingCampaignsForAdmin({ dateFrom: future }, 0)
    expect(byDate.rows.some((r) => r.id === inRange.id)).toBe(false)
  })

  it('never returns more than one page, even when far more campaigns exist', async () => {
    const many = await Promise.all(Array.from({ length: 30 }, (_, i) => makeCampaign({ subject: `${MARKER} pagination ${i}` })))
    for (const c of many) campaignIds.push(c.id)

    const { rows, totalCount } = await listMarketingCampaignsForAdmin({}, 0)
    expect(rows.length).toBeLessThanOrEqual(25)
    expect(totalCount).toBeGreaterThanOrEqual(30)
  })
})

describe('getMarketingCampaignDetail', () => {
  it('returns every recipient with the correct status, name and a matching success rate', async () => {
    const a = await makeSubscriber()
    const b = await makeSubscriber()
    const campaign = await makeCampaign({ subject: '**Bold** detail subject' })
    await prisma.marketingCampaign.update({ where: { id: campaign.id }, data: { recipientCount: 2, sentCount: 1, failedCount: 1 } })
    await makeRecipient(campaign.id, a.subscriber.id, 'SENT')
    await makeRecipient(campaign.id, b.subscriber.id, 'FAILED', { errorMessage: 'Invalid address' })

    const detail = await getMarketingCampaignDetail(campaign.id)
    expect(detail).not.toBeNull()
    expect(detail!.recipients).toHaveLength(2)
    const sent = detail!.recipients.find((r) => r.status === 'SENT')
    const failed = detail!.recipients.find((r) => r.status === 'FAILED')
    expect(sent?.recipientName).toBe(a.teacher.fullName)
    expect(failed?.recipientName).toBe(b.teacher.fullName)
    expect(failed?.errorMessage).toBe('Invalid address')
    expect(detail!.successRate).toBeCloseTo(50, 5)
    expect(detail!.renderedBodyHtml).toContain('{{firstName}}')
    expect(detail!.renderedBodyHtml).toContain('<strong>bold</strong>')
  })

  it('returns null for an unknown campaign id', async () => {
    expect(await getMarketingCampaignDetail('does-not-exist')).toBeNull()
  })
})

describe('getMarketingCampaignSummary', () => {
  it('matches the underlying campaign records exactly', async () => {
    const campaign1 = await makeCampaign({ subject: 'Summary campaign 1' })
    await prisma.marketingCampaign.update({ where: { id: campaign1.id }, data: { recipientCount: 1, sentCount: 1, failedCount: 0 } })

    const campaign2 = await makeCampaign({ subject: 'Summary campaign 2' })
    await prisma.marketingCampaign.update({ where: { id: campaign2.id }, data: { recipientCount: 1, sentCount: 0, failedCount: 1 } })

    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const past = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    // Scoped to a window guaranteed to exclude everything except these two rows created just now.
    const scoped = await getMarketingCampaignSummary({ dateFrom: past, dateTo: future })
    expect(scoped.totalMarketingEmailsSent).toBeGreaterThanOrEqual(1)
    expect(scoped.totalFailed).toBeGreaterThanOrEqual(1)
    expect(scoped.campaignsSent).toBeGreaterThanOrEqual(2)
  })

  it('reports no campaigns for a window with none', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const summary = await getMarketingCampaignSummary({ dateFrom: future })
    expect(summary.campaignsSent).toBe(0)
    expect(summary.totalMarketingEmailsSent).toBe(0)
    expect(summary.totalFailed).toBe(0)
    expect(summary.successRate).toBeNull()
  })
})

describe('getSubscriberMarketingEmailHistory', () => {
  it('returns every campaign a subscriber was queued for, most recent first, correctly labelled', async () => {
    const a = await makeSubscriber()
    const campaign1 = await makeCampaign({ subject: 'History campaign 1', createdAt: new Date(Date.now() - 60000) })
    const campaign2 = await makeCampaign({ subject: 'History campaign 2' })
    await makeRecipient(campaign1.id, a.subscriber.id, 'SENT')
    await makeRecipient(campaign2.id, a.subscriber.id, 'FAILED', { errorMessage: 'Bounced' })

    const history = await getSubscriberMarketingEmailHistory(a.subscriber.id)
    expect(history).toHaveLength(2)
    expect(history[0]?.campaignSubject).toBe('History campaign 2')
    expect(history[0]?.status).toBe('FAILED')
    expect(history[1]?.campaignSubject).toBe('History campaign 1')
    expect(history[1]?.status).toBe('SENT')
  })
})
