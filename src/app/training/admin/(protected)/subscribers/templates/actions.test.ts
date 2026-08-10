import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const {
  createMarketingTemplateAction,
  updateMarketingTemplateAction,
  duplicateMarketingTemplateAction,
  archiveMarketingTemplateAction,
} = await import('./actions')
const { prisma } = await import('@/lib/training/prisma')

const MARKER = 'marketing-template-actions-test'
const templateIds: string[] = []

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: `${MARKER} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subject: 'Test subject',
    bodyTemplate: 'Hi {{firstName}}, this is a test.',
    ...overrides,
  }
}

afterAll(async () => {
  await prisma.marketingTemplate.deleteMany({ where: { id: { in: templateIds } } })
  await prisma.auditLog.deleteMany({ where: { entityType: 'MarketingTemplate', entityId: { in: templateIds } } })
  await prisma.$disconnect()
})

describe('createMarketingTemplateAction', () => {
  it('creates a template', async () => {
    const result = await createMarketingTemplateAction(baseInput())
    expect(result.success).toBe(true)
    if (result.success) templateIds.push(result.data.id)
  })

  it('rejects a subject containing a newline', async () => {
    const result = await createMarketingTemplateAction(baseInput({ subject: 'Line one\nLine two' }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.fieldErrors?.subject).toBeDefined()
  })
})

describe('updateMarketingTemplateAction', () => {
  it('edits an existing template', async () => {
    const created = await createMarketingTemplateAction(baseInput())
    expect(created.success).toBe(true)
    if (!created.success) return
    templateIds.push(created.data.id)

    const updated = await updateMarketingTemplateAction(created.data.id, baseInput({ name: `${MARKER} edited`, subject: 'Edited subject' }))
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.subject).toBe('Edited subject')
  })
})

describe('duplicateMarketingTemplateAction', () => {
  it('creates an independent copy — editing the copy never touches the original', async () => {
    const original = await createMarketingTemplateAction(baseInput({ name: `${MARKER} original` }))
    expect(original.success).toBe(true)
    if (!original.success) return
    templateIds.push(original.data.id)

    const copy = await duplicateMarketingTemplateAction(original.data.id)
    expect(copy.success).toBe(true)
    if (!copy.success) return
    templateIds.push(copy.data.id)

    expect(copy.data.id).not.toBe(original.data.id)
    expect(copy.data.name).toBe(`Copy of ${original.data.name}`)
    expect(copy.data.subject).toBe(original.data.subject)

    await updateMarketingTemplateAction(copy.data.id, baseInput({ name: 'Edited copy', subject: 'Edited copy subject' }))

    const originalUnchanged = await prisma.marketingTemplate.findUniqueOrThrow({ where: { id: original.data.id } })
    expect(originalUnchanged.subject).toBe(original.data.subject)
  })
})

describe('archiveMarketingTemplateAction — never a hard delete', () => {
  it('sets archivedAt rather than removing the row', async () => {
    const created = await createMarketingTemplateAction(baseInput())
    expect(created.success).toBe(true)
    if (!created.success) return
    templateIds.push(created.data.id)

    const result = await archiveMarketingTemplateAction(created.data.id)
    expect(result.success).toBe(true)

    const row = await prisma.marketingTemplate.findUnique({ where: { id: created.data.id } })
    expect(row).not.toBeNull()
    expect(row?.archivedAt).not.toBeNull()
  })
})
