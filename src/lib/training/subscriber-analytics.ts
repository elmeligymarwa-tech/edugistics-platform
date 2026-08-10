import 'server-only'

import { Prisma } from '@prisma/client'

import type { TrendGranularity } from '@/domain/training/analytics'
import { prisma } from './prisma'

/**
 * ConsentEvent.occurredAt is TIMESTAMPTZ — Postgres always stores and
 * compares it as an unambiguous UTC instant, unlike Registration.registeredAt
 * (a naive TIMESTAMP with no zone attached, which needs the two-step
 * UTC-then-Cairo conversion documented in analytics.ts). A single
 * `AT TIME ZONE 'Africa/Cairo'` on a timestamptz column already produces
 * the correct Cairo wall-clock value, ready to truncate.
 */
const CAIRO_LOCAL_INSTANT_SQL = Prisma.sql`("occurredAt" AT TIME ZONE 'Africa/Cairo')`

export interface SubscriberDateRangeFilter {
  dateFrom?: Date
  dateTo?: Date
}

function occurredAtRangeSql(filters: SubscriberDateRangeFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = []
  if (filters.dateFrom) conditions.push(Prisma.sql`"occurredAt" >= ${filters.dateFrom}`)
  if (filters.dateTo) conditions.push(Prisma.sql`"occurredAt" <= ${filters.dateTo}`)
  return conditions.length > 0 ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`
}

export interface SubscriberKpis {
  totalSubscribers: number
  newInPeriod: number
  unsubscribedInPeriod: number
  netGrowth: number
  currentlySubscribed: number
}

/**
 * Every figure here has exactly one implementation — no dashboard component
 * recalculates a count. totalSubscribers/currentlySubscribed read the live
 * Subscriber table (there is no historical version of "how many rows exist
 * right now"); newInPeriod/unsubscribedInPeriod/netGrowth derive from
 * ConsentEvent so a teacher who subscribed then unsubscribed within the
 * period is correctly counted in both, not just reflected in their final state.
 */
export async function getSubscriberKpis(filters: SubscriberDateRangeFilter): Promise<SubscriberKpis> {
  const rangeSql = occurredAtRangeSql(filters)

  const [totalSubscribers, currentlySubscribed, eventCounts] = await Promise.all([
    prisma.subscriber.count(),
    prisma.subscriber.count({ where: { status: 'SUBSCRIBED' } }),
    prisma.$queryRaw<{ new_count: bigint; unsub_count: bigint }[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "eventType" IN ('SUBSCRIBED', 'RESUBSCRIBED'))::bigint AS new_count,
        COUNT(*) FILTER (WHERE "eventType" = 'UNSUBSCRIBED')::bigint AS unsub_count
      FROM "ConsentEvent"
      WHERE ${rangeSql}
    `),
  ])

  const newInPeriod = Number(eventCounts[0]?.new_count ?? 0)
  const unsubscribedInPeriod = Number(eventCounts[0]?.unsub_count ?? 0)

  return {
    totalSubscribers,
    newInPeriod,
    unsubscribedInPeriod,
    netGrowth: newInPeriod - unsubscribedInPeriod,
    currentlySubscribed,
  }
}

export interface SubscriberGrowthPoint {
  bucketStart: string
  newSubscriptions: number
  unsubscribes: number
  netGrowth: number
}

/** Growth trend bucketed by Cairo calendar day/week/month, derived entirely from ConsentEvent. */
export async function getSubscriberGrowthTrend(
  filters: SubscriberDateRangeFilter,
  granularity: TrendGranularity,
): Promise<SubscriberGrowthPoint[]> {
  const rangeSql = occurredAtRangeSql(filters)
  const unit = granularity === 'DAY' ? 'day' : granularity === 'WEEK' ? 'week' : 'month'

  const rows = await prisma.$queryRaw<{ bucket: Date; new_count: bigint; unsub_count: bigint }[]>(Prisma.sql`
    SELECT
      date_trunc(${unit}, ${CAIRO_LOCAL_INSTANT_SQL}) AS "bucket",
      COUNT(*) FILTER (WHERE "eventType" IN ('SUBSCRIBED', 'RESUBSCRIBED'))::bigint AS new_count,
      COUNT(*) FILTER (WHERE "eventType" = 'UNSUBSCRIBED')::bigint AS unsub_count
    FROM "ConsentEvent"
    WHERE ${rangeSql}
    GROUP BY 1
    ORDER BY 1 ASC
  `)

  return rows.map((row) => {
    const newSubscriptions = Number(row.new_count)
    const unsubscribes = Number(row.unsub_count)
    return {
      bucketStart: row.bucket.toISOString(),
      newSubscriptions,
      unsubscribes,
      netGrowth: newSubscriptions - unsubscribes,
    }
  })
}
