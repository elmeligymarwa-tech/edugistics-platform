import 'server-only'

import { Prisma } from '@prisma/client'

import { formatCourseDateOrSessions, formatCourseTimeRange } from '@/domain/training/format'
import { formatPromoDiscountLabel, type PromoBreakdown } from '@/domain/training/promo-code'
import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import { sendConfirmedEmail, sendWaitlistedEmail } from './email/send-registration-email'
import { hashIp } from './ip-hash'
import { normaliseEmail, normaliseGrade, normalisePhone, normaliseSubject } from './normalise'
import { prisma } from './prisma'
import { validatePromoCodeForCourse } from './promo-code-validation'
import { generateRegistrationReference } from './reference'
import { isCourseOpenForRegistration } from './registration-window'
import { resolveSchool } from './school-matching'
import { applyRegistrationConsent } from './subscribers'

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
  address: string | null
  marketingConsent: boolean
  /** The code string the browser sends back after a successful Apply, or null. Never trusted — re-validated from scratch inside the transaction below. */
  promoCode: string | null
  ip: string
}

export type { PromoBreakdown }

interface ConfirmedOutcome {
  status: 'CONFIRMED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  courseDateLong: string
  courseTimeRange: string
  emailStatus: 'SENT' | 'FAILED'
  promo: PromoBreakdown | null
}

interface WaitlistedOutcome {
  status: 'WAITLISTED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  waitlistPosition: number
  emailStatus: 'SENT' | 'FAILED'
  promo: PromoBreakdown | null
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
    const course = await tx.course.findUniqueOrThrow({
      where: { id: input.courseId },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    })

    if (!isCourseOpenForRegistration(course, now)) {
      throw new RegistrationRejectedError('This course is no longer accepting registrations.')
    }

    // Promo code: re-run the entire validation from scratch inside this
    // transaction — the browser's earlier Apply result is never trusted.
    // lockRow: true locks the PromoCode row before counting uses, so two
    // simultaneous submissions racing for the final use serialise on it
    // rather than both reading the same pre-lock count; this doubles as the
    // "re-check the total usage limit inside the transaction" step. The
    // per-teacher limit is checked separately just below, since it needs
    // this teacher's normalised email rather than anything the shared
    // validator already has.
    let promoResult: Extract<Awaited<ReturnType<typeof validatePromoCodeForCourse>>, { ok: true }> | null = null
    if (input.promoCode) {
      const validation = await validatePromoCodeForCourse({ db: tx, code: input.promoCode, course, now, lockRow: true })
      if (!validation.ok) {
        throw new RegistrationRejectedError(validation.message)
      }

      // ALL_COURSES (the default) counts a teacher's uses of this code across
      // every course; PER_COURSE scopes the same count to just this course,
      // so using the code here doesn't stop the teacher using it again on a
      // different course.
      const teacherUseCount = await tx.registration.count({
        where: {
          promoCodeId: validation.promoCode.id,
          status: 'CONFIRMED',
          teacher: { emailNormalised },
          ...(validation.promoCode.maxUsesPerTeacherScope === 'PER_COURSE' ? { courseId: course.id } : {}),
        },
      })
      if (teacherUseCount >= validation.promoCode.maxUsesPerTeacher) {
        throw new RegistrationRejectedError('This promo code has already been used with this email address.')
      }

      promoResult = validation
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

    await applyRegistrationConsent(tx, {
      teacherId: teacher.id,
      emailNormalised,
      courseId: course.id,
      marketingConsentTicked: input.marketingConsent,
      now,
      ipHash: sourceIpHash,
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
            // Written once, here, and never recalculated afterwards — a
            // WAITLISTED row gets this same snapshot but doesn't consume a
            // use, since usage counting only ever counts CONFIRMED rows.
            promoCodeId: promoResult?.promoCode.id ?? null,
            promoCodeSnapshot: promoResult?.promoCode.code ?? null,
            discountTypeSnapshot: promoResult?.promoCode.discountType ?? null,
            discountValueSnapshot: promoResult?.promoCode.discountValue ?? null,
            discountAmount: promoResult?.discountAmount ?? null,
            originalFee: promoResult?.originalFee ?? null,
            finalFee: promoResult?.finalFee ?? null,
            promoAppliedAt: promoResult ? now : null,
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

  const courseDateLong = formatCourseDateOrSessions({
    courseDate: course.courseDate,
    isMultiDay: course.isMultiDay,
    sessions: course.sessions.map((session) => session.sessionDate),
  })
  const courseTimeRange = formatCourseTimeRange(course.startTime, course.endTime)

  // Built from the registration's own stored snapshot, never recalculated —
  // if a promo was applied, this is what both the confirmation screen and
  // the confirmation email show.
  const promo: PromoBreakdown | null = registration.promoCodeSnapshot
    ? {
        code: registration.promoCodeSnapshot,
        discountType: registration.discountTypeSnapshot!,
        discountValue: Number(registration.discountValueSnapshot),
        discountLabel: formatPromoDiscountLabel(registration.discountTypeSnapshot!, Number(registration.discountValueSnapshot), course.currency),
        discountAmount: Number(registration.discountAmount),
        originalFee: Number(registration.originalFee),
        finalFee: Number(registration.finalFee),
        currency: course.currency,
      }
    : null

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
        feeAmount: promo ? promo.finalFee : Number(course.feeAmount),
        currency: course.currency,
        reference: registration.reference,
        promo,
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
      promo,
    }
  }

  return {
    status: 'WAITLISTED',
    reference: registration.reference,
    teacherFullName: teacher.fullName,
    teacherEmail: teacher.emailOriginal,
    courseName: course.name,
    waitlistPosition: waitlistPosition!,
    promo,
    emailStatus,
  }
}
