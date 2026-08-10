import 'server-only'

import type { MarketingRecipientStatus, Prisma } from '@prisma/client'

import { MARKETING_CAMPAIGN_PAGE_SIZE, type MarketingCampaignFilters } from '@/domain/training/marketing-campaign-filters'
import { prisma } from '../prisma'
import { resolveDisplayName } from '../subscribers-admin'
import { renderCampaignBodyHtml } from './rich-text'

/**
 * The single authoritative implementation of every marketing-campaign
 * metric in the admin — the campaign history list, the campaign detail
 * view, the subscribers analytics panel and the subscriber detail's
 * marketing email history all read from the functions in this file.
 * Nothing here is ever recomputed inside a component.
 */

function buildMarketingCampaignWhere(filters: MarketingCampaignFilters): Prisma.MarketingCampaignWhereInput {
  const where: Prisma.MarketingCampaignWhereInput = {}
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }
  return where
}

/** Of the recipients a campaign has a result for (SENT + FAILED — excluding still-PENDING or SKIPPED_UNSUBSCRIBED), the fraction that succeeded. Null when nothing has been attempted yet. */
function successRate(sentCount: number, failedCount: number): number | null {
  const attempted = sentCount + failedCount
  return attempted === 0 ? null : (sentCount / attempted) * 100
}

export interface MarketingCampaignListItem {
  id: string
  createdAt: Date
  subject: string
  recipientCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  successRate: number | null
}

/** Paginated, most-recent-first. Never fetches more than one page's worth of campaigns. */
export async function listMarketingCampaignsForAdmin(
  filters: MarketingCampaignFilters,
  page: number,
): Promise<{ rows: MarketingCampaignListItem[]; totalCount: number }> {
  const where = buildMarketingCampaignWhere(filters)
  const [rows, totalCount] = await Promise.all([
    prisma.marketingCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * MARKETING_CAMPAIGN_PAGE_SIZE,
      take: MARKETING_CAMPAIGN_PAGE_SIZE,
    }),
    prisma.marketingCampaign.count({ where }),
  ])

  return {
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      subject: row.subject,
      recipientCount: row.recipientCount,
      sentCount: row.sentCount,
      failedCount: row.failedCount,
      skippedCount: row.skippedCount,
      successRate: successRate(row.sentCount, row.failedCount),
    })),
    totalCount,
  }
}

export interface MarketingCampaignDetailRecipient {
  id: string
  recipientName: string
  emailAddress: string
  status: MarketingRecipientStatus
  sentAt: Date | null
  errorMessage: string | null
}

export interface MarketingCampaignDetailData {
  id: string
  createdAt: Date
  subject: string
  bodyTemplate: string
  /** The body template rendered through the same markdown-lite formatter the composer preview uses — tokens still visible as authored, not resolved per recipient. */
  renderedBodyHtml: string
  recipientCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  successRate: number | null
  recipients: MarketingCampaignDetailRecipient[]
}

/** Includes every recipient row — bounded by the configurable safety limit, so this never risks loading an unbounded set. */
export async function getMarketingCampaignDetail(campaignId: string): Promise<MarketingCampaignDetailData | null> {
  const row = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: {
        select: {
          id: true,
          emailAddress: true,
          status: true,
          sentAt: true,
          errorMessage: true,
          subscriber: { select: { fullName: true, teacher: { select: { fullName: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!row) return null

  return {
    id: row.id,
    createdAt: row.createdAt,
    subject: row.subject,
    bodyTemplate: row.bodyTemplate,
    renderedBodyHtml: renderCampaignBodyHtml(row.bodyTemplate),
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    successRate: successRate(row.sentCount, row.failedCount),
    recipients: row.recipients.map((recipient) => ({
      id: recipient.id,
      recipientName: resolveDisplayName(recipient.subscriber),
      emailAddress: recipient.emailAddress,
      status: recipient.status,
      sentAt: recipient.sentAt,
      errorMessage: recipient.errorMessage,
    })),
  }
}

export interface MarketingCampaignSummary {
  totalMarketingEmailsSent: number
  totalFailed: number
  /** Of the ones with a known outcome (sent + failed); null when nothing has resolved yet. Never opens/clicks — Resend does not report those reliably, so this admin surfaces nothing that isn't real. */
  successRate: number | null
  campaignsSent: number
}

/** Aggregates over every MarketingCampaign matching `filters` (all campaigns when omitted). */
export async function getMarketingCampaignSummary(filters: MarketingCampaignFilters = {}): Promise<MarketingCampaignSummary> {
  const where = buildMarketingCampaignWhere(filters)
  const aggregate = await prisma.marketingCampaign.aggregate({
    where,
    _sum: { sentCount: true, failedCount: true },
    _count: { _all: true },
  })

  const totalMarketingEmailsSent = aggregate._sum.sentCount ?? 0
  const totalFailed = aggregate._sum.failedCount ?? 0

  return {
    totalMarketingEmailsSent,
    totalFailed,
    successRate: successRate(totalMarketingEmailsSent, totalFailed),
    campaignsSent: aggregate._count._all,
  }
}

export interface SubscriberMarketingEmailHistoryItem {
  id: string
  date: Date
  campaignSubject: string
  status: MarketingRecipientStatus
}

/** Every marketing message a subscriber was ever queued for, most recent first — shown on the subscriber detail page. */
export async function getSubscriberMarketingEmailHistory(subscriberId: string): Promise<SubscriberMarketingEmailHistoryItem[]> {
  const rows = await prisma.marketingCampaignRecipient.findMany({
    where: { subscriberId },
    select: { id: true, status: true, sentAt: true, createdAt: true, campaign: { select: { subject: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((row) => ({
    id: row.id,
    date: row.sentAt ?? row.createdAt,
    campaignSubject: row.campaign.subject,
    status: row.status,
  }))
}
