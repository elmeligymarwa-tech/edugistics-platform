import 'server-only'

import { Prisma } from '@prisma/client'

import { formatCourseDateLong, formatCourseTimeRange } from '@/domain/training/format'
import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import { sendConfirmedEmail, sendWaitlistedEmail } from './email/send-registration-email'
import { hashIp } from './ip-hash'
import { normaliseEmail, normaliseGrade, normalisePhone, normaliseSubject } from './normalise'
import { prisma } from './prisma'
import { generateRegistrationReference } from './reference'
import { isCourseOpenForRegistration } from './registration-window'
import { resolveSchool } from './school-matching'

/** Carries the exact user-facing message from CLAUDE.md's server-side submission rules straight out of the transaction. */
export class RegistrationRejectedError extends Error {}

export interface RegisterInput {
  courseId: string
  fullName: string
  email: string
  phone: string
  schoolName: string
  subject: string
  grade: string
  address: string
  marketingConsent: boolean
  ip: string
}

interface ConfirmedOutcome {
  status: 'CONFIRMED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  courseDateLong: string
  courseTimeRange: string
  emailStatus: 'SENT' | 'FAILED'
}

interface WaitlistedOutcome {
  status: 'WAITLISTED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  waitlistPosition: number
  emailStatus: 'SENT' | 'FAILED'
}

export type RegistrationOutcome = ConfirmedOutcome | WaitlistedOutcome

const MAX_REFERENCE_ATTEMPTS = 5

function isUniqueConstraintOnReference(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false
  const target = (error.meta as { target?: unknown })?.target
  return Array.isArray(target) && target.includes('reference')
}

/**
 * Runs the full submission flow from CLAUDE.md's SERVER SIDE SUBMISSION LOGIC
 * (steps 5-10) inside a single transaction, then sends the confirmation email
 * after commit (step 11) and records emailStatus (step 12). Validation, the
 * honeypot check and rate limiting happen in the caller — this function
 * assumes its input is already valid.
 */
export async function registerForCourse(input: RegisterInput): Promise<RegistrationOutcome> {
  const now = new Date()
  const emailNormalised = normaliseEmail(input.email)
  const sourceIpHash = await hashIp(input.ip)

  const { teacher, course, registration, waitlistPosition } = await prisma.$transaction(async (tx) => {
    const existingTeacher = await tx.teacher.findUnique({ where: { emailNormalised } })

    if (existingTeacher) {
      const existingRegistration = await tx.registration.findUnique({
        where: { courseId_teacherId: { courseId: input.courseId, teacherId: existingTeacher.id } },
      })
      if (existingRegistration && existingRegistration.status !== 'CANCELLED') {
        throw new RegistrationRejectedError('This email address is already registered for this course.')
      }
    }

    // Row lock first, before any writes — a course that's invalid or full
    // should reject without ever touching the teacher/school tables.
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Course" WHERE id = ${input.courseId} FOR UPDATE`
    if (lockedRows.length === 0) {
      throw new RegistrationRejectedError('This course is no longer available.')
    }
    const course = await tx.course.findUniqueOrThrow({ where: { id: input.courseId } })

    if (!isCourseOpenForRegistration(course, now)) {
      throw new RegistrationRejectedError('This course is no longer accepting registrations.')
    }

    const confirmedCount = await tx.registration.count({ where: { courseId: course.id, status: 'CONFIRMED' } })
    const isFull = course.maxCapacity != null && confirmedCount >= course.maxCapacity

    let status: 'CONFIRMED' | 'WAITLISTED'
    let waitlistPosition: number | null = null

    if (!isFull) {
      status = 'CONFIRMED'
    } else if (!course.waitlistEnabled) {
      throw new RegistrationRejectedError('This course is now full.')
    } else {
      const waitlistedCount = await tx.registration.count({ where: { courseId: course.id, status: 'WAITLISTED' } })
      if (course.waitlistCapacity != null && waitlistedCount >= course.waitlistCapacity) {
        throw new RegistrationRejectedError('This course and its waiting list are both full.')
      }
      status = 'WAITLISTED'
      waitlistPosition = waitlistedCount + 1
    }

    const school = await resolveSchool(tx, input.schoolName)

    const teacher = existingTeacher
      ? await tx.teacher.update({
          where: { id: existingTeacher.id },
          data: {
            fullName: input.fullName,
            phone: input.phone,
            phoneNormalised: normalisePhone(input.phone),
            address: input.address,
            schoolId: school.id,
            schoolNameOriginal: input.schoolName,
            subjectOriginal: input.subject,
            subjectNormalised: normaliseSubject(input.subject),
            gradeOriginal: input.grade,
            gradeNormalised: normaliseGrade(input.grade),
            marketingConsent: input.marketingConsent,
            marketingConsentAt: input.marketingConsent ? now : existingTeacher.marketingConsentAt,
            lastRegisteredAt: now,
          },
        })
      : await tx.teacher.create({
          data: {
            emailNormalised,
            emailOriginal: input.email,
            fullName: input.fullName,
            phone: input.phone,
            phoneNormalised: normalisePhone(input.phone),
            address: input.address,
            schoolId: school.id,
            schoolNameOriginal: input.schoolName,
            subjectOriginal: input.subject,
            subjectNormalised: normaliseSubject(input.subject),
            gradeOriginal: input.grade,
            gradeNormalised: normaliseGrade(input.grade),
            marketingConsent: input.marketingConsent,
            marketingConsentAt: input.marketingConsent ? now : null,
            firstRegisteredAt: now,
            lastRegisteredAt: now,
          },
        })

    let registration: Prisma.PromiseReturnType<typeof tx.registration.create> | undefined
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      const reference = generateRegistrationReference(now)
      try {
        registration = await tx.registration.create({
          data: {
            reference,
            teacherId: teacher.id,
            courseId: course.id,
            courseNameSnapshot: course.name,
            courseDateSnapshot: course.courseDate,
            courseFeeSnapshot: course.feeAmount,
            courseCurrencySnapshot: course.currency,
            status,
            waitlistPosition,
            registeredAt: now,
            consentGiven: input.marketingConsent,
            consentAt: input.marketingConsent ? now : null,
            emailStatus: 'PENDING',
            emailType: status,
            sourceIpHash,
          },
        })
        break
      } catch (error) {
        if (isUniqueConstraintOnReference(error)) continue
        throw error
      }
    }

    if (!registration) {
      throw new Error('Could not generate a unique registration reference.')
    }

    return { teacher, course, registration, waitlistPosition }
  })

  const courseDateLong = formatCourseDateLong(course.courseDate)
  const courseTimeRange = formatCourseTimeRange(course.startTime, course.endTime)

  let emailStatus: 'SENT' | 'FAILED'
  try {
    if (registration.status === 'CONFIRMED') {
      await sendConfirmedEmail(teacher.emailOriginal, {
        teacherName: teacher.fullName,
        courseName: course.name,
        courseDateLong,
        courseTimeRange,
        deliveryMethodLabel: DELIVERY_METHOD_LABELS[course.deliveryMethod],
        location: course.location,
        joiningInstructions: course.joiningInstructions,
        feeAmount: Number(course.feeAmount),
        currency: course.currency,
        reference: registration.reference,
      })
    } else {
      await sendWaitlistedEmail(teacher.emailOriginal, {
        teacherName: teacher.fullName,
        courseName: course.name,
        waitlistPosition: waitlistPosition!,
        reference: registration.reference,
      })
    }
    emailStatus = 'SENT'
    await prisma.registration.update({
      where: { id: registration.id },
      data: { emailSent: true, emailSentAt: new Date(), emailStatus: 'SENT' },
    })
  } catch (error) {
    emailStatus = 'FAILED'
    await prisma.registration.update({
      where: { id: registration.id },
      data: { emailStatus: 'FAILED', emailError: error instanceof Error ? error.message : 'Unknown error' },
    })
  }

  if (registration.status === 'CONFIRMED') {
    return {
      status: 'CONFIRMED',
      reference: registration.reference,
      teacherFullName: teacher.fullName,
      teacherEmail: teacher.emailOriginal,
      courseName: course.name,
      courseDateLong,
      courseTimeRange,
      emailStatus,
    }
  }

  return {
    status: 'WAITLISTED',
    reference: registration.reference,
    teacherFullName: teacher.fullName,
    teacherEmail: teacher.emailOriginal,
    courseName: course.name,
    waitlistPosition: waitlistPosition!,
    emailStatus,
  }
}
