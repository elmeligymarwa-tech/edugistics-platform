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
 * Registration has `@@unique([courseId, teacherId])` — one row per
 * teacher per course, full stop, regardless of that row's status. The
 * pre-check below already rejects a second attempt while an existing
 * CONFIRMED/WAITLISTED registration stands; this recognises the same
 * constraint firing anyway, which happens in two situations neither of
 * those checks catches on its own: a genuine race (two submissions for the
 * same teacher+course land between the pre-check and this insert), and the
 * moment right after this function reactivates a CANCELLED row in place —
 * see the `reactivating` branch below — where it's a defensive fallback
 * only, never expected to actually fire.
 */
export function isUniqueConstraintOnCourseTeacher(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false
  const target = (error.meta as { target?: unknown })?.target
  return Array.isArray(target) && target.includes('courseId') && target.includes('teacherId')
}

/**
 * The other half of the same race: two concurrent submissions for a teacher
 * email that doesn't exist yet both see `existingTeacher` as null and both
 * attempt `tx.teacher.create`. `Teacher.emailNormalised` is unique on its
 * own, independent of `Registration`'s constraint, so the loser collides
 * here first — before ever reaching `tx.registration.create` below.
 */
export function isUniqueConstraintOnTeacherEmail(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false
  const target = (error.meta as { target?: unknown })?.target
  return Array.isArray(target) && target.includes('emailNormalised')
}

/** Consistent wording wherever a submission is rejected because this teacher already has a live row for this course — the pre-check, and the race fallback below, both use this so the two paths never disagree on phrasing. */
export function alreadyRegisteredMessage(existing: { status: string; reference: string }): string {
  const activity = existing.status === 'WAITLISTED' ? 'already on the waiting list for' : 'already registered for'
  return `This email address is ${activity} this course. Your reference is ${existing.reference}.`
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

  const { teacher, course, registration, waitlistPosition } = await runRegistrationTransaction()

  async function runRegistrationTransaction() {
    try {
      return await prisma.$transaction(transactionCallback)
    } catch (error) {
      if (isUniqueConstraintOnTeacherEmail(error)) {
        // Lost the race to create the Teacher row, not to register for this
        // course — the teacher we were about to create now exists, created
        // by whichever concurrent request won. That's unrelated to whether
        // *this* courseId is free, so retry once: `transactionCallback`
        // re-reads `existingTeacher` from scratch, finds the row that now
        // exists, and proceeds as an ordinary existing-teacher registration
        // instead of attempting another create. This is what makes the same
        // email registering for two different courses at once succeed
        // twice, rather than the loser being wrongly told it's already
        // registered for a course it never touched. Capped at one retry —
        // if it fails the exact same way again, something more persistent
        // than a one-off race is wrong, so we stop rather than loop.
        try {
          return await prisma.$transaction(transactionCallback)
        } catch (retryError) {
          error = retryError
        }
      }

      if (!isUniqueConstraintOnCourseTeacher(error) && !isUniqueConstraintOnTeacherEmail(error)) throw error

      // Genuine duplicate: another request registered this exact
      // teacher+course pairing — either on the original attempt (the
      // teacher already existed, so the retry above never ran) or on the
      // retry itself. By the time Postgres reports a unique-constraint
      // conflict the other transaction is guaranteed to have fully
      // committed, so this lookup — run against `prisma` directly, not the
      // now-aborted `tx` — is safe and will find what it left behind.
      const racedTeacher = await prisma.teacher.findUnique({ where: { emailNormalised } })
      const racedRegistration = racedTeacher
        ? await prisma.registration.findUnique({
            where: { courseId_teacherId: { courseId: input.courseId, teacherId: racedTeacher.id } },
          })
        : null
      throw new RegistrationRejectedError(
        racedRegistration ? alreadyRegisteredMessage(racedRegistration) : 'This email address is already registered for this course.',
      )
    }
  }

  async function transactionCallback(tx: Prisma.TransactionClient) {
    const existingTeacher = await tx.teacher.findUnique({ where: { emailNormalised } })

    // A CANCELLED registration for this exact teacher+course still occupies
    // the row the unique constraint enforces — the database has no concept
    // of "cancelled doesn't count", so a second CONFIRMED/WAITLISTED row can
    // never be inserted alongside it. Reactivating that row in place (see
    // below, where `reactivating` is used instead of a fresh create) is what
    // actually lets someone register again after cancelling, rather than the
    // insert always failing with a P2002 the caller never intended to hit.
    let reactivating: Prisma.PromiseReturnType<typeof tx.registration.findUnique> = null

    if (existingTeacher) {
      const existingRegistration = await tx.registration.findUnique({
        where: { courseId_teacherId: { courseId: input.courseId, teacherId: existingTeacher.id } },
      })
      if (existingRegistration) {
        if (existingRegistration.status !== 'CANCELLED') {
          throw new RegistrationRejectedError(alreadyRegisteredMessage(existingRegistration))
        }
        reactivating = existingRegistration
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

    // Shared between a fresh row and a reactivated one — every field this
    // submission determines, independent of whether it ends up as an
    // insert or an update. Written once, here, and never recalculated
    // afterwards — a WAITLISTED row gets this same snapshot but doesn't
    // consume a use, since usage counting only ever counts CONFIRMED rows.
    const registrationData = {
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
      emailStatus: 'PENDING' as const,
      emailType: status,
      sourceIpHash,
      promoCodeId: promoResult?.promoCode.id ?? null,
      promoCodeSnapshot: promoResult?.promoCode.code ?? null,
      discountTypeSnapshot: promoResult?.promoCode.discountType ?? null,
      discountValueSnapshot: promoResult?.promoCode.discountValue ?? null,
      discountAmount: promoResult?.discountAmount ?? null,
      originalFee: promoResult?.originalFee ?? null,
      finalFee: promoResult?.finalFee ?? null,
      promoAppliedAt: promoResult ? now : null,
    }

    let registration: Prisma.PromiseReturnType<typeof tx.registration.create> | undefined

    if (reactivating) {
      // Same row, same reference — this is the same teacher's same course
      // slot coming back to CONFIRMED/WAITLISTED, not a new registration
      // event, so there is no reference to regenerate. Every field a fresh
      // create would have set from scratch is reset explicitly, including
      // the email-delivery bookkeeping (a re-registration needs its own
      // confirmation/waitlist email, not the cancelled one's stale status)
      // and cancelledAt, which must be cleared for the row to read as active.
      registration = await tx.registration.update({
        where: { id: reactivating.id },
        data: { ...registrationData, emailSent: false, emailSentAt: null, emailError: null, cancelledAt: null },
      })
    } else {
      for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
        const reference = generateRegistrationReference(now)
        try {
          registration = await tx.registration.create({ data: { ...registrationData, reference } })
          break
        } catch (error) {
          if (isUniqueConstraintOnReference(error)) continue
          // A courseId/teacherId collision here (lost a race against another
          // request for this same teacher+course) is deliberately left
          // uncaught: Postgres aborts the whole transaction on any failed
          // statement, so a lookup against `tx` at this point would itself
          // fail with "current transaction is aborted" rather than ever
          // producing a useful result. It propagates out of `$transaction`
          // instead, where the caller below can safely query with a fresh
          // connection once the transaction has actually rolled back.
          throw error
        }
      }
    }

    if (!registration) {
      throw new Error('Could not generate a unique registration reference.')
    }

    return { teacher, course, registration, waitlistPosition }
  }

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
