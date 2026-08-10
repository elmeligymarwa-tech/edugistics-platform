import type { ConsentSource, SubscriberStatus } from '@prisma/client'

import { cairoDateTimeLocalToUtc } from './timezone'

export const SUBSCRIBERS_PAGE_SIZE = 50

/** 'ALL' is a distinct, deliberate choice from either single status — never the default. */
export type SubscriberStatusFilter = SubscriberStatus | 'ALL'

export type SubscriberSortField = 'subscribedAt' | 'name' | 'emailsSent'
export type SortDirection = 'asc' | 'desc'

/**
 * The single filter shape every subscriber query accepts. status defaults
 * to 'SUBSCRIBED' via parseSubscriberSearchParams below — never leave it
 * undefined/omitted when querying, or an unfiltered list mixing
 * unsubscribed contacts into what looks like a mailing audience becomes
 * possible again.
 */
export interface SubscriberFilters {
  search?: string
  status: SubscriberStatusFilter
  schoolId?: string
  subject?: string
  grade?: string
  dateFrom?: Date
  dateTo?: Date
  consentCourseId?: string
  source?: ConsentSource
}

const STATUS_VALUES = new Set<string>(['SUBSCRIBED', 'UNSUBSCRIBED', 'ALL'])
const SOURCE_VALUES = new Set<string>(['TRAINING_REGISTRATION', 'ADMIN_MANUAL', 'MIGRATED'])
const SORT_FIELD_VALUES = new Set<string>(['subscribedAt', 'name', 'emailsSent'])

/**
 * CRITICAL DEFAULT: status is 'SUBSCRIBED' whenever the URL doesn't say
 * otherwise. An administrator switching to 'All' or 'Unsubscribed' is a
 * deliberate act, never the page's resting state.
 */
export function parseSubscriberSearchParams(params: Record<string, string | undefined>): SubscriberFilters {
  const filters: SubscriberFilters = {
    status: params.status && STATUS_VALUES.has(params.status) ? (params.status as SubscriberStatusFilter) : 'SUBSCRIBED',
  }

  if (params.q) filters.search = params.q
  if (params.schoolId) filters.schoolId = params.schoolId
  if (params.subject) filters.subject = params.subject
  if (params.grade) filters.grade = params.grade
  if (params.courseId) filters.consentCourseId = params.courseId
  if (params.source && SOURCE_VALUES.has(params.source)) filters.source = params.source as ConsentSource
  if (params.from) filters.dateFrom = cairoDateTimeLocalToUtc(`${params.from}T00:00`)
  if (params.to) filters.dateTo = cairoDateTimeLocalToUtc(`${params.to}T23:59`)

  return filters
}

export function parseSubscriberSort(params: Record<string, string | undefined>): { sortField: SubscriberSortField; sortDir: SortDirection } {
  const sortField = params.sortField && SORT_FIELD_VALUES.has(params.sortField) ? (params.sortField as SubscriberSortField) : 'subscribedAt'
  const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc'
  return { sortField, sortDir }
}
