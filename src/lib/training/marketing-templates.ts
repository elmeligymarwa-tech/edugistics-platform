import 'server-only'

import type { MarketingTemplateValues } from '@/domain/training/marketing-template-schema'
import { prisma } from './prisma'

export interface MarketingTemplateListItem {
  id: string
  name: string
  subject: string
  bodyTemplate: string
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** Active templates first, most recently created within each group — archived templates are never hidden, just kept out of the way. */
export async function listMarketingTemplatesForAdmin(): Promise<MarketingTemplateListItem[]> {
  return prisma.marketingTemplate.findMany({
    orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
  })
}

export async function listActiveMarketingTemplatesForComposer(): Promise<MarketingTemplateListItem[]> {
  return prisma.marketingTemplate.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getMarketingTemplate(id: string): Promise<MarketingTemplateListItem | null> {
  return prisma.marketingTemplate.findUnique({ where: { id } })
}

export async function createMarketingTemplate(values: MarketingTemplateValues): Promise<MarketingTemplateListItem> {
  return prisma.marketingTemplate.create({ data: values })
}

export async function updateMarketingTemplate(id: string, values: MarketingTemplateValues): Promise<MarketingTemplateListItem> {
  return prisma.marketingTemplate.update({ where: { id }, data: values })
}

/** A copy is a new, independent template — editing the copy never touches the original, and archiving the original never touches the copy. */
export async function duplicateMarketingTemplate(id: string): Promise<MarketingTemplateListItem | null> {
  const original = await prisma.marketingTemplate.findUnique({ where: { id } })
  if (!original) return null
  return prisma.marketingTemplate.create({
    data: { name: `Copy of ${original.name}`, subject: original.subject, bodyTemplate: original.bodyTemplate },
  })
}

/** Never a hard delete — archivedAt keeps the row (and anything that has ever referenced it) resolvable. */
export async function archiveMarketingTemplate(id: string): Promise<MarketingTemplateListItem> {
  return prisma.marketingTemplate.update({ where: { id }, data: { archivedAt: new Date() } })
}
