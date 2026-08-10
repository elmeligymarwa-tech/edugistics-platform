'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { z } from 'zod'

import { resolveCourseIds } from '@/domain/training/promo-code'
import { promoCodeFormSchema } from '@/domain/training/promo-code-schema'
import { writeAuditLog } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { prisma } from '@/lib/training/prisma'
import { isPromoCodeAvailable } from '@/lib/training/promo-codes'

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

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

const DUPLICATE_CODE_RESULT = {
  success: false as const,
  error: 'Please fix the highlighted fields.',
  fieldErrors: { code: 'This code is already in use.' },
}

function revalidate() {
  revalidatePath('/training/admin/promo-codes')
}

/** Shared create/update payload — currency only matters for FIXED_AMOUNT; PERCENTAGE codes always store the column default so a stray value never lingers from a previous edit. */
function toPromoCodeData(values: z.infer<typeof promoCodeFormSchema>) {
  return {
    code: values.code,
    description: values.description,
    discountType: values.discountType,
    discountValue: values.discountValue,
    currency: values.discountType === 'FIXED_AMOUNT' ? values.currency!.trim() : 'EGP',
    appliesToAllCourses: values.appliesToAllCourses,
    startsAt: values.startsAt,
    expiresAt: values.expiresAt,
    maxTotalUses: values.maxTotalUses,
    maxUsesPerTeacher: values.maxUsesPerTeacher,
    maxUsesPerTeacherScope: values.maxUsesPerTeacherScope,
    isPaused: values.isPaused,
  }
}

export async function createPromoCodeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdminSession()

  const parsed = promoCodeFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }
  const values = parsed.data

  if (!(await isPromoCodeAvailable(values.code))) {
    return DUPLICATE_CODE_RESULT
  }

  const courseIds = resolveCourseIds(values.appliesToAllCourses, values.courseIds)

  try {
    const promoCode = await prisma.$transaction(async (tx) => {
      const created = await tx.promoCode.create({ data: toPromoCodeData(values) })
      if (courseIds.length > 0) {
        await tx.promoCodeCourse.createMany({ data: courseIds.map((courseId) => ({ promoCodeId: created.id, courseId })) })
      }
      return created
    })

    await writeAuditLog({
      action: 'PROMO_CODE_CREATED',
      entityType: 'PromoCode',
      entityId: promoCode.id,
      afterJson: { ...toPromoCodeData(values), startsAt: values.startsAt?.toISOString() ?? null, expiresAt: values.expiresAt?.toISOString() ?? null, courseIds },
    })

    revalidate()
    return { success: true, data: { id: promoCode.id } }
  } catch (error) {
    if (isUniqueConflict(error)) return DUPLICATE_CODE_RESULT
    throw error
  }
}

export async function updatePromoCodeAction(id: string, input: unknown): Promise<ActionResult> {
  await requireAdminSession()

  const parsed = promoCodeFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }
  const values = parsed.data

  const existing = await prisma.promoCode.findUnique({ where: { id } })
  if (!existing) return { success: false, error: 'Promo code not found.' }

  if (!(await isPromoCodeAvailable(values.code, id))) {
    return DUPLICATE_CODE_RESULT
  }

  const courseIds = resolveCourseIds(values.appliesToAllCourses, values.courseIds)
  const before = {
    code: existing.code,
    description: existing.description,
    discountType: existing.discountType,
    discountValue: Number(existing.discountValue),
    currency: existing.currency,
    appliesToAllCourses: existing.appliesToAllCourses,
    startsAt: existing.startsAt?.toISOString() ?? null,
    expiresAt: existing.expiresAt?.toISOString() ?? null,
    maxTotalUses: existing.maxTotalUses,
    maxUsesPerTeacher: existing.maxUsesPerTeacher,
    maxUsesPerTeacherScope: existing.maxUsesPerTeacherScope,
    isPaused: existing.isPaused,
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.promoCode.update({ where: { id }, data: toPromoCodeData(values) })
      await tx.promoCodeCourse.deleteMany({ where: { promoCodeId: id } })
      if (courseIds.length > 0) {
        await tx.promoCodeCourse.createMany({ data: courseIds.map((courseId) => ({ promoCodeId: id, courseId })) })
      }
    })

    await writeAuditLog({
      action: 'PROMO_CODE_EDITED',
      entityType: 'PromoCode',
      entityId: id,
      beforeJson: before,
      afterJson: { ...toPromoCodeData(values), startsAt: values.startsAt?.toISOString() ?? null, expiresAt: values.expiresAt?.toISOString() ?? null, courseIds },
    })

    revalidate()
    return { success: true, data: undefined }
  } catch (error) {
    if (isUniqueConflict(error)) return DUPLICATE_CODE_RESULT
    throw error
  }
}

/** Backs the list's pause/resume toggle — one action, the boolean decides which audit action gets written, mirroring the course active-toggle pattern. */
export async function setPromoCodePausedAction(id: string, isPaused: boolean): Promise<ActionResult> {
  await requireAdminSession()

  const existing = await prisma.promoCode.findUnique({ where: { id } })
  if (!existing) return { success: false, error: 'Promo code not found.' }
  if (existing.archivedAt) return { success: false, error: 'This promo code is archived and cannot be paused or resumed.' }
  if (existing.isPaused === isPaused) return { success: true, data: undefined }

  await prisma.promoCode.update({ where: { id }, data: { isPaused } })
  await writeAuditLog({
    action: isPaused ? 'PROMO_CODE_PAUSED' : 'PROMO_CODE_RESUMED',
    entityType: 'PromoCode',
    entityId: id,
    beforeJson: { isPaused: existing.isPaused },
    afterJson: { isPaused },
  })

  revalidate()
  return { success: true, data: undefined }
}

/** Archives never hard-delete — archivedAt is set so historical/future registrations can always still resolve this code. Idempotent: archiving an already-archived code is a no-op success, not an error. */
export async function archivePromoCodeAction(id: string): Promise<ActionResult> {
  await requireAdminSession()

  const existing = await prisma.promoCode.findUnique({ where: { id } })
  if (!existing) return { success: false, error: 'Promo code not found.' }
  if (existing.archivedAt) return { success: true, data: undefined }

  const archivedAt = new Date()
  await prisma.promoCode.update({ where: { id }, data: { archivedAt } })
  await writeAuditLog({
    action: 'PROMO_CODE_ARCHIVED',
    entityType: 'PromoCode',
    entityId: id,
    beforeJson: { archivedAt: null },
    afterJson: { archivedAt: archivedAt.toISOString() },
  })

  revalidate()
  return { success: true, data: undefined }
}
