'use server'

import { revalidatePath } from 'next/cache'

import { formatCourseDateLong, formatCourseTimeRange } from '@/domain/training/format'
import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import { ADMIN_ACTOR } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { sendPromotedEmail } from '@/lib/training/email/send-registration-email'
import { prisma } from '@/lib/training/prisma'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; blockedAtCapacity?: boolean }

/**
 * Promotes one waitlisted registration to CONFIRMED. Blocks at capacity
 * unless `override` is set, in which case the override itself is what gets
 * audited alongside the promotion — see the spec's "log every override" rule.
 */
export async function promoteRegistrationAction(registrationId: string, override = false): Promise<ActionResult> {
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

    const updated = await tx.registration.update({
      where: { id: registration.id },
      data: {
        status: 'CONFIRMED',
        promotedAt,
        waitlistPosition: null,
        emailType: 'PROMOTED',
        emailStatus: 'PENDING',
      },
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
        afterJson: { status: 'CONFIRMED', promotedAt: promotedAt.toISOString() },
      },
    })

    return { kind: 'promoted' as const, registration: updated, teacher: registration.teacher, course }
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

  const { registration, teacher, course } = outcome

  try {
    await sendPromotedEmail(teacher.emailOriginal, {
      teacherName: teacher.fullName,
      courseName: course.name,
      courseDateLong: formatCourseDateLong(course.courseDate),
      courseTimeRange: formatCourseTimeRange(course.startTime, course.endTime),
      deliveryMethodLabel: DELIVERY_METHOD_LABELS[course.deliveryMethod],
      location: course.location,
      joiningInstructions: course.joiningInstructions,
      feeAmount: Number(course.feeAmount),
      currency: course.currency,
      reference: registration.reference,
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

  revalidatePath(`/training/admin/courses/${course.id}/waitlist`)
  revalidatePath('/training/admin/registrations')
  revalidatePath('/training/admin/courses')
  return { success: true, data: undefined }
}
