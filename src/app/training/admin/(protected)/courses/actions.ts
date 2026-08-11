'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { z } from 'zod'

import { prisma } from '@/lib/training/prisma'
import { requireAdminSession } from '@/lib/training/auth/require-admin'
import { generateUniqueCourseSlug } from '@/lib/training/course-slug'
import { courseFormSchema, type CourseFormValues } from '@/domain/training/schema'
import { timeStringToDate } from '@/domain/training/time'
import { cairoDateTimeLocalToUtc } from '@/domain/training/timezone'

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

/** The earliest of a non-empty list of dates — used to derive a multi-day course's stored courseDate from its session dates. */
function earliestDate(dates: Date[]): Date {
  return dates.reduce((earliest, date) => (date < earliest ? date : earliest))
}

/**
 * The stored isMultiDay/courseDate/durationMinutes are derived here from
 * whether sessionDates is non-empty, never copied verbatim from the form's
 * own isMultiDay flag — courseFormSchema's superRefine already rejects a
 * genuinely inconsistent submission (e.g. isMultiDay: true with no
 * sessionDates), but this is what makes the server authoritative rather
 * than merely validating: even a technically-consistent payload is
 * re-derived, not trusted. Does not touch CourseSession rows themselves —
 * those are handled separately by the caller, since they live in a related
 * table rather than a scalar column.
 */
function toCourseData(values: CourseFormValues) {
  const startTime = timeStringToDate(values.startTime)
  const endTime = timeStringToDate(values.endTime)
  const isMultiDay = values.sessionDates.length > 0

  return {
    name: values.name,
    shortDescription: values.shortDescription,
    fullDescription: values.fullDescription,
    category: values.category,
    courseDate: isMultiDay ? earliestDate(values.sessionDates) : values.courseDate,
    startTime,
    endTime,
    isMultiDay,
    durationMinutes: isMultiDay ? null : values.durationMinutes!,
    deliveryMethod: values.deliveryMethod,
    location: values.location ?? null,
    joiningInstructions: values.joiningInstructions ?? null,
    feeAmount: values.feeAmount,
    currency: values.currency,
    registrationOpensAt: values.registrationOpensAt ? cairoDateTimeLocalToUtc(values.registrationOpensAt) : null,
    registrationClosesAt: values.registrationClosesAt ? cairoDateTimeLocalToUtc(values.registrationClosesAt) : null,
    maxCapacity: values.maxCapacity ?? null,
    waitlistEnabled: values.waitlistEnabled,
    waitlistCapacity: values.waitlistCapacity ?? null,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    zoomLink: values.zoomLink ?? null,
    zoomMeetingId: values.zoomMeetingId ?? null,
    zoomPasscode: values.zoomPasscode ?? null,
    reminderSubject: values.reminderSubject ?? null,
    reminderMessage: values.reminderMessage ?? null,
  }
}

function isSlugConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function createCourseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdminSession()

  const parsed = courseFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  const slug = await generateUniqueCourseSlug(parsed.data.name)

  try {
    const course = await prisma.course.create({
      data: {
        ...toCourseData(parsed.data),
        slug,
        sessions:
          parsed.data.sessionDates.length > 0
            ? { create: parsed.data.sessionDates.map((sessionDate) => ({ sessionDate })) }
            : undefined,
      },
    })
    revalidatePath('/training/admin/courses')
    return { success: true, data: { id: course.id } }
  } catch (error) {
    if (isSlugConflict(error)) {
      return { success: false, error: 'A course with this name was just created — please try saving again.' }
    }
    throw error
  }
}

// The slug is intentionally left out of the update payload — it is set once
// on create and never regenerated, so links already shared for this course
// keep working.
export async function updateCourseAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdminSession()

  const parsed = courseFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsFromZod(parsed.error) }
  }

  // Full replace-the-set semantics for sessions: every existing session row
  // is deleted and the submitted list re-created, rather than diffed —
  // simplest correct way to support "the administrator ... can remove any
  // of them" without tracking which rows are new vs pre-existing.
  const course = await prisma.$transaction(async (tx) => {
    await tx.courseSession.deleteMany({ where: { courseId: id } })
    if (parsed.data.sessionDates.length > 0) {
      await tx.courseSession.createMany({
        data: parsed.data.sessionDates.map((sessionDate) => ({ courseId: id, sessionDate })),
      })
    }
    return tx.course.update({ where: { id }, data: toCourseData(parsed.data) })
  })
  revalidatePath('/training/admin/courses')
  return { success: true, data: { id: course.id } }
}

export async function archiveCourseAction(id: string): Promise<ActionResult> {
  await requireAdminSession()
  await prisma.course.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } })
  revalidatePath('/training/admin/courses')
  return { success: true, data: undefined }
}

export async function toggleCourseActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession()
  await prisma.course.update({ where: { id }, data: { isActive } })
  revalidatePath('/training/admin/courses')
  return { success: true, data: undefined }
}
