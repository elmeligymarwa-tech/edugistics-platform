import 'server-only'

import type { EmailStatus, Prisma } from '@prisma/client'

import { CAMPAIGN_PAGE_SIZE, type CampaignFilters } from '@/domain/training/campaign-filters'
import type { CampaignEmailType } from '@/domain/training/schema'
import { prisma } from '../prisma'
import { renderCampaignBodyHtml } from './rich-text'

/**
 * The single authoritative implementation of every campaign/communication
 * metric in the admin — the emails list, the campaign detail view, the
 * communication summary panel, the teacher communication history, and the
 * registrations-table signal all read from the functions in this file.
 * Nothing here is ever recomputed inside a component (Phase 4 rule).
 */

function buildCampaignWhere(filters: CampaignFilters): Prisma.EmailCampaignWhereInput {
  const where: Prisma.EmailCampaignWhereInput = {}
  if (filters.courseId) where.courseId = filters.courseId
  if (filters.emailType) where.emailType = filters.emailType
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }
  return where
}

/** Of the recipients a campaign has a result for (SENT + FAILED — excluding still-PENDING), the fraction that succeeded. Null when nothing has been attempted yet. */
function successRate(sentCount: number, failedCount: number): number | null {
  const attempted = sentCount + failedCount
  return attempted === 0 ? null : (sentCount / attempted) * 100
}

export interface CampaignListItem {
  id: string
  createdAt: Date
  courseId: string | null
  courseName: string | null
  subject: string
  emailType: CampaignEmailType
  recipientCount: number
  sentCount: number
  failedCount: number
  successRate: number | null
}

/** Paginated, most-recent-first. Never fetches more than one page's worth of campaigns. */
export async function listCampaignsForAdmin(
  filters: CampaignFilters,
  page: number,
): Promise<{ rows: CampaignListItem[]; totalCount: number }> {
  const where = buildCampaignWhere(filters)
  const [rows, totalCount] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      include: { course: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: page * CAMPAIGN_PAGE_SIZE,
      take: CAMPAIGN_PAGE_SIZE,
    }),
    prisma.emailCampaign.count({ where }),
  ])

  return {
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      courseId: row.courseId,
      courseName: row.course?.name ?? null,
      subject: row.subject,
      emailType: row.emailType,
      recipientCount: row.recipientCount,
      sentCount: row.sentCount,
      failedCount: row.failedCount,
      successRate: successRate(row.sentCount, row.failedCount),
    })),
    totalCount,
  }
}

export interface CampaignDetailData {
  id: string
  createdAt: Date
  courseId: string | null
  courseName: string | null
  subject: string
  bodyTemplate: string
  /** The body template rendered through the same markdown-lite formatter the composer preview uses — tokens still visible as authored, not resolved per recipient (no single rendering could represent every recipient's own values). */
  renderedBodyHtml: string
  emailType: CampaignEmailType
  recipientCount: number
  sentCount: number
  failedCount: number
  successRate: number | null
  recipients: CampaignDetailRecipient[]
}

export interface CampaignDetailRecipient {
  id: string
  teacherName: string
  emailAddress: string
  status: EmailStatus
  sentAt: Date | null
  errorMessage: string | null
}

/** Includes every recipient row — bounded by the 500-recipient safety limit, so this never risks loading an unbounded set. */
export async function getCampaignDetail(campaignId: string): Promise<CampaignDetailData | null> {
  const row = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      course: { select: { name: true } },
      recipients: {
        select: { id: true, emailAddress: true, status: true, sentAt: true, errorMessage: true, teacher: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!row) return null

  return {
    id: row.id,
    createdAt: row.createdAt,
    courseId: row.courseId,
    courseName: row.course?.name ?? null,
    subject: row.subject,
    bodyTemplate: row.bodyTemplate,
    renderedBodyHtml: renderCampaignBodyHtml(row.bodyTemplate),
    emailType: row.emailType,
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    successRate: successRate(row.sentCount, row.failedCount),
    recipients: row.recipients.map((recipient) => ({
      id: recipient.id,
      teacherName: recipient.teacher.fullName,
      emailAddress: recipient.emailAddress,
      status: recipient.status,
      sentAt: recipient.sentAt,
      errorMessage: recipient.errorMessage,
    })),
  }
}

export interface CampaignFilterOptions {
  courses: { id: string; name: string }[]
}

export async function getCampaignFilterOptions(): Promise<CampaignFilterOptions> {
  const courses = await prisma.course.findMany({ select: { id: true, name: true }, orderBy: { courseDate: 'desc' } })
  return { courses }
}

export interface CommunicationSummary {
  /** Every EmailCampaignRecipient row written for a matching campaign, regardless of outcome — the true volume of mail the system attempted to send. */
  totalCampaignEmails: number
  totalSuccessful: number
  totalFailed: number
  /** Of the ones with a known outcome (successful + failed); null when nothing has resolved yet. */
  successRate: number | null
  distinctCoursesCommunicated: number
  distinctTeachersContacted: number
}

/**
 * Aggregates over campaigns matching `filters` (all campaigns when omitted).
 * distinctCoursesCommunicated is read from each recipient's own registration
 * — never from EmailCampaign.courseId, which is null for a campaign that
 * spanned multiple courses and would otherwise undercount them.
 */
export async function getCommunicationSummary(filters: CampaignFilters = {}): Promise<CommunicationSummary> {
  const where = buildCampaignWhere(filters)
  const campaigns = await prisma.emailCampaign.findMany({
    where,
    select: { id: true, recipientCount: true, sentCount: true, failedCount: true },
  })

  const totalCampaignEmails = campaigns.reduce((sum, c) => sum + c.recipientCount, 0)
  const totalSuccessful = campaigns.reduce((sum, c) => sum + c.sentCount, 0)
  const totalFailed = campaigns.reduce((sum, c) => sum + c.failedCount, 0)

  if (campaigns.length === 0) {
    return { totalCampaignEmails, totalSuccessful, totalFailed, successRate: null, distinctCoursesCommunicated: 0, distinctTeachersContacted: 0 }
  }

  const recipients = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    select: { teacherId: true, registration: { select: { courseId: true } } },
  })

  return {
    totalCampaignEmails,
    totalSuccessful,
    totalFailed,
    successRate: successRate(totalSuccessful, totalFailed),
    distinctCoursesCommunicated: new Set(recipients.map((r) => r.registration.courseId)).size,
    distinctTeachersContacted: new Set(recipients.map((r) => r.teacherId)).size,
  }
}

const REGISTRATION_EMAIL_LABELS: Record<'CONFIRMED' | 'WAITLISTED' | 'PROMOTED', string> = {
  CONFIRMED: 'Registration confirmed',
  WAITLISTED: 'Waitlist notification',
  PROMOTED: 'Place confirmed',
}

export interface CommunicationHistoryItem {
  id: string
  date: Date
  courseName: string
  subject: string
  emailType: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  failureReason: string | null
  source: 'REGISTRATION' | 'CAMPAIGN'
}

/**
 * Every message a teacher has received in one place — both the automated
 * per-registration emails (confirmation/waitlist/promotion) and every bulk
 * campaign they were a recipient of — merged and sorted most-recent-first.
 * `source` labels which kind each row is so the two are never confused.
 */
export async function getTeacherCommunicationHistory(teacherId: string): Promise<CommunicationHistoryItem[]> {
  const [registrations, campaignRecipients] = await Promise.all([
    prisma.registration.findMany({
      where: { teacherId },
      select: {
        id: true,
        courseNameSnapshot: true,
        emailType: true,
        emailStatus: true,
        emailSentAt: true,
        emailError: true,
        registeredAt: true,
      },
    }),
    prisma.emailCampaignRecipient.findMany({
      where: { teacherId },
      select: {
        id: true,
        status: true,
        sentAt: true,
        errorMessage: true,
        createdAt: true,
        registration: { select: { courseNameSnapshot: true } },
        campaign: { select: { subject: true, emailType: true } },
      },
    }),
  ])

  const registrationItems: CommunicationHistoryItem[] = registrations.map((r) => ({
    id: r.id,
    date: r.emailSentAt ?? r.registeredAt,
    courseName: r.courseNameSnapshot,
    subject: REGISTRATION_EMAIL_LABELS[r.emailType],
    emailType: r.emailType,
    status: r.emailStatus,
    failureReason: r.emailError,
    source: 'REGISTRATION',
  }))

  const campaignItems: CommunicationHistoryItem[] = campaignRecipients.map((r) => ({
    id: r.id,
    date: r.sentAt ?? r.createdAt,
    courseName: r.registration.courseNameSnapshot,
    subject: r.campaign.subject,
    emailType: r.campaign.emailType,
    status: r.status,
    failureReason: r.errorMessage,
    source: 'CAMPAIGN',
  }))

  return [...registrationItems, ...campaignItems].sort((a, b) => b.date.getTime() - a.date.getTime())
}

export interface CampaignEmailSignal {
  count: number
  lastSentAt: Date | null
}

/** Batched — one query for a whole page of teacherIds, never per-row. Powers the compact "already emailed" signal on the registrations table. */
export async function getCampaignEmailSignalsForTeachers(teacherIds: string[]): Promise<Map<string, CampaignEmailSignal>> {
  if (teacherIds.length === 0) return new Map()

  const rows = await prisma.emailCampaignRecipient.groupBy({
    by: ['teacherId'],
    where: { teacherId: { in: teacherIds }, status: 'SENT' },
    _count: { _all: true },
    _max: { sentAt: true },
  })

  return new Map(rows.map((row) => [row.teacherId, { count: row._count._all, lastSentAt: row._max.sentAt }]))
}
