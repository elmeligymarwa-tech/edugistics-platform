'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'

import { marketingTemplateSchema } from '@/domain/training/marketing-template-schema'
import { writeAuditLog } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import {
  archiveMarketingTemplate,
  createMarketingTemplate,
  duplicateMarketingTemplate,
  getMarketingTemplate,
  updateMarketingTemplate,
  type MarketingTemplateListItem,
} from '@/lib/training/marketing-templates'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> }

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

function revalidateTemplates() {
  revalidatePath('/training/admin/subscribers/templates')
}

export async function createMarketingTemplateAction(input: unknown): Promise<ActionResult<MarketingTemplateListItem>> {
  await requireAdminSession()

  const parsed = marketingTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  const template = await createMarketingTemplate(parsed.data)
  await writeAuditLog({ action: 'MARKETING_TEMPLATE_CREATED', entityType: 'MarketingTemplate', entityId: template.id, afterJson: parsed.data })

  revalidateTemplates()
  return { success: true, data: template }
}

export async function updateMarketingTemplateAction(id: string, input: unknown): Promise<ActionResult<MarketingTemplateListItem>> {
  await requireAdminSession()

  const parsed = marketingTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  const before = await getMarketingTemplate(id)
  if (!before) return { success: false, error: 'Template not found.' }

  const template = await updateMarketingTemplate(id, parsed.data)
  await writeAuditLog({
    action: 'MARKETING_TEMPLATE_EDITED',
    entityType: 'MarketingTemplate',
    entityId: id,
    beforeJson: { name: before.name, subject: before.subject, bodyTemplate: before.bodyTemplate },
    afterJson: parsed.data,
  })

  revalidateTemplates()
  return { success: true, data: template }
}

export async function duplicateMarketingTemplateAction(id: string): Promise<ActionResult<MarketingTemplateListItem>> {
  await requireAdminSession()

  const copy = await duplicateMarketingTemplate(id)
  if (!copy) return { success: false, error: 'Template not found.' }

  await writeAuditLog({ action: 'MARKETING_TEMPLATE_DUPLICATED', entityType: 'MarketingTemplate', entityId: copy.id, afterJson: { duplicatedFrom: id } })

  revalidateTemplates()
  return { success: true, data: copy }
}

export async function archiveMarketingTemplateAction(id: string): Promise<ActionResult> {
  await requireAdminSession()

  const template = await archiveMarketingTemplate(id)
  await writeAuditLog({ action: 'MARKETING_TEMPLATE_ARCHIVED', entityType: 'MarketingTemplate', entityId: template.id })

  revalidateTemplates()
  return { success: true, data: undefined }
}
