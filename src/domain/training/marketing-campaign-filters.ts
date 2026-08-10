import { cairoDateTimeLocalToUtc } from './timezone'

export const MARKETING_CAMPAIGN_PAGE_SIZE = 25

export interface MarketingCampaignFilters {
  dateFrom?: Date
  dateTo?: Date
}

/** Mirrors parseCampaignSearchParams's shape and conventions so every campaign filter bar in the admin behaves identically. */
export function parseMarketingCampaignSearchParams(params: Record<string, string | undefined>): MarketingCampaignFilters {
  const filters: MarketingCampaignFilters = {}
  if (params.from) filters.dateFrom = cairoDateTimeLocalToUtc(`${params.from}T00:00`)
  if (params.to) filters.dateTo = cairoDateTimeLocalToUtc(`${params.to}T23:59`)
  return filters
}
