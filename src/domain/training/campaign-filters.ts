import { cairoDateTimeLocalToUtc } from './timezone'
import type { CampaignEmailType } from './schema'

export const CAMPAIGN_PAGE_SIZE = 25

export interface CampaignFilters {
  courseId?: string
  emailType?: CampaignEmailType
  dateFrom?: Date
  dateTo?: Date
}

const EMAIL_TYPE_VALUES = new Set<string>(['REMINDER', 'ZOOM_LINK', 'UPDATE', 'CUSTOM'])

/** Mirrors parseRegistrationSearchParams's shape and conventions so the two filter bars behave identically. */
export function parseCampaignSearchParams(params: Record<string, string | undefined>): CampaignFilters {
  const filters: CampaignFilters = {}
  if (params.courseId) filters.courseId = params.courseId
  if (params.emailType && EMAIL_TYPE_VALUES.has(params.emailType)) filters.emailType = params.emailType as CampaignEmailType
  if (params.from) filters.dateFrom = cairoDateTimeLocalToUtc(`${params.from}T00:00`)
  if (params.to) filters.dateTo = cairoDateTimeLocalToUtc(`${params.to}T23:59`)
  return filters
}
