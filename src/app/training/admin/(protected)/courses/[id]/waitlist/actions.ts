'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'

import { formatCourseDateLong, formatCourseTimeRange } from '@/domain/training/format'
import { formatPromoDiscountLabel } from '@/domain/training/promo-code'
import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import { ADMIN_ACTOR } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { sendPromotedEmail } from '@/lib/training/email/send-registration-email'
import { prisma } from '@/lib/training/prisma'
import { validatePromoCodeForCourse } from '@/lib/training/promo-code-validation'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; blockedAtCapacity?: boolean }

/**
 * Promotes one waitlisted registration to CONFIRMED. Blocks at capacity
 * unless `override` is set, in which case the override itself is what gets
 * audited alongside the promotion — see the spec's "log every override" rule.
 *
 * `sendEmail` is a deliberate, required choice made by the caller (see
 * PromoteRegistrationDialog) — never defaulted to true, since sending the
 * confirmation/joining email is not an automatic side effect of promotion.
 * Someone promoted long after the course has already happened should not
 * receive a "you're in" email for something that's over.
 */
export async function promoteRegistrationAction(
  registrationId: string,
  { override = false, sendEmail }: { override?: boolean; sendEmail: boolean },
): Promise<ActionResult<{ discountLost: boolean }>> {
  await requireAdminSession()

  const outcome = await prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
      include: { teacher: true, course: true },
    })
    if (!registration) return { kind: 'not-found' as const }
    if (registration.status !== 'WAITLISTED') return { kind: 'not-waitlisted' as const }

    const course = registration.course

    // Row lock first, mirroring the public registration flow, so a concurrent
    // promotion or new registration can't race past the capacity check.
    await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${course.id} FOR UPDATE`
    const confirmedCount = await tx.registration.count({ where: { courseId: course.id, status: 'CONFIRMED' } })
    const atCapacity = course.maxCapacity != null && confirmedCount >= course.maxCapacity

    if (atCapacity && !override) {
      return { kind: 'blocked' as const }
    }

    const before = { status: registration.status, waitlistPosition: registration.waitlistPosition }
    const promotedAt = new Date()

    const updateData: Prisma.RegistrationUncheckedUpdateInput = {
      status: 'CONFIRMED',
      promotedAt,
      waitlistPosition: null,
      // emailType/emailStatus are only touched when an email is actually
      // going to be sent below — if the caller chose not to send one, these
      // fields keep describing the last email that was actually sent (the
      // original WAITLISTED confirmation), rather than claiming a PROMOTED
      // email is PENDING when none will ever be sent.
      ...(sendEmail ? { emailType: 'PROMOTED' as const, emailStatus: 'PENDING' as const } : {}),
    }

    // Re-validate the promo code at the moment of promotion — the moment a
    // use is actually about to be consumed, since usage counting only ever
    // counts CONFIRMED rows. Locks the PromoCode row (same order as the
    // public submission transaction: Course, then PromoCode) so this can't
    // race a simultaneous registration for the code's final use.
    let discountLost = false
    if (registration.promoCodeId && registration.promoCodeSnapshot) {
      const validation = await validatePromoCodeForCourse({
        db: tx,
        code: registration.promoCodeSnapshot,
        course,
        now: promotedAt,
        lockRow: true,
      })
      if (validation.ok) {
        // Still valid and has capacity — the snapshot stands untouched, and
        // the use is consumed the instant status flips to CONFIRMED below.
      } else {
        discountLost = true
        updateData.promoCodeId = null
        updateData.promoCodeSnapshot = null
        updateData.discountTypeSnapshot = null
        updateData.discountValueSnapshot = null
        updateData.discountAmount = null
        updateData.originalFee = null
        updateData.finalFee = null
        updateData.promoAppliedAt = null
      }
    }

    const updated = await tx.registration.update({
      where: { id: registration.id },
      data: updateData,
    })

    const remaining = await tx.registration.findMany({
      where: { courseId: course.id, status: 'WAITLISTED' },
      orderBy: { waitlistPosition: 'asc' },
    })
    for (let index = 0; index < remaining.length; index += 1) {
      const desiredPosition = index + 1
      if (remaining[index]!.waitlistPosition !== desiredPosition) {
        await tx.registration.update({
          where: { id: remaining[index]!.id },
          data: { waitlistPosition: desiredPosition },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        actor: ADMIN_ACTOR,
        action: atCapacity ? 'REGISTRATION_PROMOTED_OVERRIDE' : 'REGISTRATION_PROMOTED',
        entityType: 'Registration',
        entityId: registration.id,
        beforeJson: before,
        afterJson: { status: 'CONFIRMED', promotedAt: promotedAt.toISOString(), discountLost, sendEmail },
      },
    })

    return { kind: 'promoted' as const, registration: updated, teacher: registration.teacher, course, discountLost }
  })

  if (outcome.kind === 'not-found') return { success: false, error: 'Registration not found.' }
  if (outcome.kind === 'not-waitlisted') return { success: false, error: 'This registration is no longer on the waiting list.' }
  if (outcome.kind === 'blocked') {
    return {
      success: false,
      error: 'This course is at capacity. Confirm the override to promote anyway.',
      blockedAtCapacity: true,
    }
  }

  const { registration, teacher, course, discountLost } = outcome

  // sendEmail is a deliberate choice made at the point of promotion (see
  // PromoteRegistrationDialog) — never automatic. When it's false, nothing
  // in this block runs: emailType/emailStatus were left untouched above,
  // by design, rather than set to a PENDING send that will never happen.
  if (sendEmail) {
    const promo = registration.promoCodeSnapshot
      ? {
          code: registration.promoCodeSnapshot,
          discountLabel: formatPromoDiscountLabel(registration.discountTypeSnapshot!, Number(registration.discountValueSnapshot), course.currency),
          discountAmount: Number(registration.discountAmount),
          originalFee: Number(registration.originalFee),
        }
      : null

    try {
      await sendPromotedEmail(teacher.emailOriginal, {
        teacherName: teacher.fullName,
        courseName: course.name,
        courseDateLong: formatCourseDateLong(course.courseDate),
        courseTimeRange: formatCourseTimeRange(course.startTime, course.endTime),
        deliveryMethodLabel: DELIVERY_METHOD_LABELS[course.deliveryMethod],
        location: course.location,
        joiningInstructions: course.joiningInstructions,
        feeAmount: registration.finalFee != null ? Number(registration.finalFee) : Number(course.feeAmount),
        currency: course.currency,
        reference: registration.reference,
        promo,
      })
      await prisma.registration.update({
        where: { id: registration.id },
        data: { emailSent: true, emailSentAt: new Date(), emailStatus: 'SENT' },
      })
    } catch (error) {
      await prisma.registration.update({
        where: { id: registration.id },
        data: { emailStatus: 'FAILED', emailError: error instanceof Error ? error.message : 'Unknown error' },
      })
    }
  }

  revalidatePath(`/training/admin/courses/${course.id}/waitlist`)
  revalidatePath('/training/admin/registrations')
  revalidatePath('/training/admin/courses')
  return { success: true, data: { discountLost } }
}
