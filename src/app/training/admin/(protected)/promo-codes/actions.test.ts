import { afterAll, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { createPromoCodeAction, updatePromoCodeAction, setPromoCodePausedAction, archivePromoCodeAction } = await import('./actions')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning, following the pattern already used across this codebase's
// action tests (e.g. courses/[id]/waitlist/actions.test.ts) — hits the real database.
const MARKER = 'promo-code-actions-test'
const promoCodeIds: string[] = []

/** Promo codes only allow A-Z0-9 — MARKER (used for descriptions/course names) has hyphens, so codes need their own clean generator. */
function randomCode(): string {
  return `PROMOTEST${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    code: randomCode(),
    description: 'Test promo code',
    discountType: 'PERCENTAGE',
    discountValue: '10',
    appliesToAllCourses: true,
    courseIds: [],
    startsAt: '',
    expiresAt: '',
    maxTotalUses: '',
    maxUsesPerTeacher: '1',
    isPaused: false,
    ...overrides,
  }
}

afterAll(async () => {
  await prisma.promoCodeCourse.deleteMany({ where: { promoCodeId: { in: promoCodeIds } } })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.auditLog.deleteMany({ where: { entityId: { in: promoCodeIds } } })
  await prisma.$disconnect()
})

describe('createPromoCodeAction — uniqueness', () => {
  it('rejects a duplicate code among non-archived codes, including a lowercase entry of an existing code', async () => {
    const code = randomCode()
    const first = await createPromoCodeAction(baseInput({ code }))
    expect(first.success).toBe(true)
    if (first.success) promoCodeIds.push(first.data.id)

    const second = await createPromoCodeAction(baseInput({ code: code.toLowerCase() }))
    expect(second.success).toBe(false)
    if (second.success) return
    expect(second.fieldErrors?.code).toBeDefined()
  })

  it('lets an archived code\'s value be reused by a new code', async () => {
    const code = randomCode()
    const first = await createPromoCodeAction(baseInput({ code }))
    expect(first.success).toBe(true)
    if (!first.success) return
    promoCodeIds.push(first.data.id)

    const archived = await archivePromoCodeAction(first.data.id)
    expect(archived.success).toBe(true)

    const second = await createPromoCodeAction(baseInput({ code }))
    expect(second.success).toBe(true)
    if (second.success) promoCodeIds.push(second.data.id)
  })

  it('writes an audit log entry on create', async () => {
    const result = await createPromoCodeAction(baseInput())
    expect(result.success).toBe(true)
    if (!result.success) return
    promoCodeIds.push(result.data.id)

    const auditRow = await prisma.auditLog.findFirst({ where: { entityId: result.data.id, action: 'PROMO_CODE_CREATED' } })
    expect(auditRow).not.toBeNull()
  })
})

describe('createPromoCodeAction — courses', () => {
  it('stores the selected courses when appliesToAllCourses is false', async () => {
    const course = await prisma.course.create({
      data: {
        name: `${MARKER} course`,
        slug: `${MARKER}-course-${Date.now()}`,
        shortDescription: 'x',
        fullDescription: 'x',
        category: 'LEADERSHIP',
        courseDate: new Date('2026-09-01T00:00:00.000Z'),
        startTime: new Date('1970-01-01T09:00:00.000Z'),
        endTime: new Date('1970-01-01T10:00:00.000Z'),
        durationMinutes: 60,
        deliveryMethod: 'ONLINE',
      },
    })

    const created = await createPromoCodeAction(baseInput({ appliesToAllCourses: false, courseIds: [course.id] }))
    expect(created.success).toBe(true)
    if (!created.success) return
    promoCodeIds.push(created.data.id)

    const joinRows = await prisma.promoCodeCourse.findMany({ where: { promoCodeId: created.data.id } })
    expect(joinRows).toHaveLength(1)
    expect(joinRows[0]!.courseId).toBe(course.id)

    await prisma.promoCodeCourse.deleteMany({ where: { promoCodeId: created.data.id } })
    await prisma.course.delete({ where: { id: course.id } })
  })

  it('clears any individually selected courses when appliesToAllCourses is true, on both create and edit', async () => {
    const created = await createPromoCodeAction(baseInput({ appliesToAllCourses: true, courseIds: ['does-not-exist'] }))
    expect(created.success).toBe(true)
    if (!created.success) return
    promoCodeIds.push(created.data.id)

    const joinRowsAfterCreate = await prisma.promoCodeCourse.findMany({ where: { promoCodeId: created.data.id } })
    expect(joinRowsAfterCreate).toHaveLength(0)

    const code = (await prisma.promoCode.findUniqueOrThrow({ where: { id: created.data.id } })).code
    const edited = await updatePromoCodeAction(
      created.data.id,
      baseInput({ code, appliesToAllCourses: true, courseIds: ['still-does-not-exist'] }),
    )
    expect(edited.success).toBe(true)

    const joinRowsAfterEdit = await prisma.promoCodeCourse.findMany({ where: { promoCodeId: created.data.id } })
    expect(joinRowsAfterEdit).toHaveLength(0)
  })
})

describe('setPromoCodePausedAction', () => {
  it('pauses and resumes, writing distinct audit actions each time', async () => {
    const created = await createPromoCodeAction(baseInput())
    expect(created.success).toBe(true)
    if (!created.success) return
    promoCodeIds.push(created.data.id)

    const paused = await setPromoCodePausedAction(created.data.id, true)
    expect(paused.success).toBe(true)
    const afterPause = await prisma.promoCode.findUniqueOrThrow({ where: { id: created.data.id } })
    expect(afterPause.isPaused).toBe(true)
    const pauseAudit = await prisma.auditLog.findFirst({ where: { entityId: created.data.id, action: 'PROMO_CODE_PAUSED' } })
    expect(pauseAudit).not.toBeNull()

    const resumed = await setPromoCodePausedAction(created.data.id, false)
    expect(resumed.success).toBe(true)
    const afterResume = await prisma.promoCode.findUniqueOrThrow({ where: { id: created.data.id } })
    expect(afterResume.isPaused).toBe(false)
    const resumeAudit = await prisma.auditLog.findFirst({ where: { entityId: created.data.id, action: 'PROMO_CODE_RESUMED' } })
    expect(resumeAudit).not.toBeNull()
  })
})

describe('archivePromoCodeAction', () => {
  it('sets archivedAt rather than deleting the row, and writes an audit entry', async () => {
    const created = await createPromoCodeAction(baseInput())
    expect(created.success).toBe(true)
    if (!created.success) return
    promoCodeIds.push(created.data.id)

    const result = await archivePromoCodeAction(created.data.id)
    expect(result.success).toBe(true)

    const row = await prisma.promoCode.findUniqueOrThrow({ where: { id: created.data.id } })
    expect(row.archivedAt).not.toBeNull()

    const auditRow = await prisma.auditLog.findFirst({ where: { entityId: created.data.id, action: 'PROMO_CODE_ARCHIVED' } })
    expect(auditRow).not.toBeNull()
  })

  it('never hard deletes — the row still exists after archiving', async () => {
    const created = await createPromoCodeAction(baseInput())
    expect(created.success).toBe(true)
    if (!created.success) return
    promoCodeIds.push(created.data.id)

    await archivePromoCodeAction(created.data.id)
    const count = await prisma.promoCode.count({ where: { id: created.data.id } })
    expect(count).toBe(1)
  })
})
