'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { z } from 'zod'

import { formatCourseDateLong, formatCourseTimeRange } from '@/domain/training/format'
import { formatPromoDiscountLabel } from '@/domain/training/promo-code'
import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import { adminEditRegistrationSchema } from '@/domain/training/registration-schema'
import { writeAuditLog } from '@/lib/training/audit-log'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { sendConfirmedEmail, sendPromotedEmail, sendWaitlistedEmail } from '@/lib/training/email/send-registration-email'
import { normaliseEmail, normaliseGrade, normalisePhone, normaliseSubject } from '@/lib/training/normalise'
import { prisma } from '@/lib/training/prisma'
import {
  listRegistrationsForAdmin,
  parseRegistrationSearchParams,
  type RegistrationListItem,
} from '@/lib/training/registrations'
import { resolveSchool } from '@/lib/training/school-matching'

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

function revalidateRegistration(id: string) {
  revalidatePath('/training/admin/registrations')
  revalidatePath(`/training/admin/registrations/${id}`)
}

/**
 * One page of a single course's registrations for the "By course" view.
 * Re-parses the raw URL search params with the same parser the flat table
 * uses, so a section's contents always honour the page's current filters.
 */
export async function fetchCourseRegistrationsPageAction(
  courseId: string,
  searchParams: Record<string, string | undefined>,
  page: number,
): Promise<{ rows: RegistrationListItem[]; totalCount: number }> {
  await requireAdminSession()
  const filters = parseRegistrationSearchParams(searchParams)
  return listRegistrationsForAdmin({ ...filters, courseId }, page)
}

export async function cancelRegistrationAction(id: string): Promise<ActionResult> {
  await requireAdminSession()

  const registration = await prisma.registration.findUnique({ where: { id } })
  if (!registration) return { success: false, error: 'Registration not found.' }
  if (registration.status === 'CANCELLED') return { success: true, data: undefined }

  const now = new Date()
  await prisma.registration.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: now },
  })

  await writeAuditLog({
    action: 'REGISTRATION_CANCELLED',
    entityType: 'Registration',
    entityId: id,
    beforeJson: { status: registration.status, waitlistPosition: registration.waitlistPosition },
    afterJson: { status: 'CANCELLED', cancelledAt: now.toISOString() },
  })

  revalidateRegistration(id)
  revalidatePath(`/training/admin/courses/${registration.courseId}/waitlist`)
  return { success: true, data: undefined }
}

export async function resendRegistrationEmailAction(id: string): Promise<ActionResult> {
  await requireAdminSession()

  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { teacher: true, course: true },
  })
  if (!registration) return { success: false, error: 'Registration not found.' }
  if (registration.emailStatus !== 'FAILED') {
    return { success: false, error: 'Only failed emails can be resent.' }
  }
  if (registration.status === 'CANCELLED') {
    return { success: false, error: 'This registration has been cancelled.' }
  }

  const { teacher, course } = registration

  const promo = registration.promoCodeSnapshot
    ? {
        code: registration.promoCodeSnapshot,
        discountLabel: formatPromoDiscountLabel(registration.discountTypeSnapshot!, Number(registration.discountValueSnapshot), course.currency),
        discountAmount: Number(registration.discountAmount),
        originalFee: Number(registration.originalFee),
      }
    : null

  try {
    if (registration.emailType === 'CONFIRMED' || registration.emailType === 'PROMOTED') {
      const params = {
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
      }
      if (registration.emailType === 'CONFIRMED') {
        await sendConfirmedEmail(teacher.emailOriginal, params)
      } else {
        await sendPromotedEmail(teacher.emailOriginal, params)
      }
    } else {
      if (registration.waitlistPosition == null) {
        return { success: false, error: 'This registration no longer has a waiting list position.' }
      }
      await sendWaitlistedEmail(teacher.emailOriginal, {
        teacherName: teacher.fullName,
        courseName: course.name,
        waitlistPosition: registration.waitlistPosition,
        reference: registration.reference,
      })
    }

    await prisma.registration.update({
      where: { id },
      data: { emailSent: true, emailSentAt: new Date(), emailStatus: 'SENT', emailError: null },
    })
    await writeAuditLog({
      action: 'REGISTRATION_EMAIL_RESENT',
      entityType: 'Registration',
      entityId: id,
      afterJson: { emailType: registration.emailType, emailStatus: 'SENT' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await prisma.registration.update({ where: { id }, data: { emailStatus: 'FAILED', emailError: message } })
    revalidateRegistration(id)
    return { success: false, error: `Resend failed: ${message}` }
  }

  revalidateRegistration(id)
  return { success: true, data: undefined }
}

function isEmailConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function updateRegistrationAction(id: string, input: unknown): Promise<ActionResult> {
  await requireAdminSession()

  const parsed = adminEditRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }
  const values = parsed.data

  const registration = await prisma.registration.findUnique({ where: { id }, include: { teacher: true } })
  if (!registration) return { success: false, error: 'Registration not found.' }

  const teacher = registration.teacher
  const emailNormalised = normaliseEmail(values.email)

  try {
    const before = {
      fullName: teacher.fullName,
      email: teacher.emailOriginal,
      phone: teacher.phone,
      address: teacher.address,
      schoolName: teacher.schoolNameOriginal,
      subject: teacher.subjectOriginal,
      grade: teacher.gradeOriginal,
      marketingConsent: teacher.marketingConsent,
    }

    await prisma.$transaction(async (tx) => {
      const school = await resolveSchool(tx, values.schoolName)
      await tx.teacher.update({
        where: { id: teacher.id },
        data: {
          fullName: values.fullName,
          emailOriginal: values.email,
          emailNormalised,
          phone: values.phone,
          phoneNormalised: normalisePhone(values.phone),
          address: values.address,
          schoolId: school.id,
          schoolNameOriginal: values.schoolName,
          subjectOriginal: values.subject,
          subjectNormalised: normaliseSubject(values.subject),
          gradeOriginal: values.grade,
          gradeNormalised: normaliseGrade(values.grade),
          marketingConsent: values.marketingConsent,
          marketingConsentAt: values.marketingConsent ? (teacher.marketingConsentAt ?? new Date()) : teacher.marketingConsentAt,
        },
      })
    })

    await writeAuditLog({
      action: 'REGISTRATION_EDITED',
      entityType: 'Registration',
      entityId: id,
      beforeJson: before,
      afterJson: values,
    })
  } catch (error) {
    if (isEmailConflict(error)) {
      return {
        success: false,
        error: 'Another teacher is already registered with this email address.',
        fieldErrors: { email: 'This email address is already in use.' },
      }
    }
    throw error
  }

  revalidateRegistration(id)
  return { success: true, data: undefined }
}
