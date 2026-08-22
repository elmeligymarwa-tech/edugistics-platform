import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

const sendConfirmedEmail = vi.fn().mockResolvedValue('email-id')
const sendWaitlistedEmail = vi.fn().mockResolvedValue('email-id')

vi.mock('./email/send-registration-email', () => ({
  sendConfirmedEmail: (...args: unknown[]) => sendConfirmedEmail(...args),
  sendWaitlistedEmail: (...args: unknown[]) => sendWaitlistedEmail(...args),
}))

const { registerForCourse, RegistrationRejectedError } = await import('./register-for-course')
const { subscribeFromLandingPage } = await import('./landing-subscribe')
const { prisma } = await import('./prisma')

// Self-contained and self-cleaning, following the pattern in registrations.test.ts.
// Hits the real database configured via DATABASE_URL — the capacity/waitlist
// logic runs inside a row-locked transaction, so there is no mockable
// boundary between this module and Postgres for the race-condition test.
const MARKER = 'register-for-course-test'
const courseIds: string[] = []
const teacherEmails: string[] = []
const promoCodeIds: string[] = []

const courseDefaults = {
  shortDescription: 'x',
  fullDescription: 'x',
  category: 'LEADERSHIP' as const,
  startTime: new Date('1970-01-01T09:00:00.000Z'),
  endTime: new Date('1970-01-01T10:00:00.000Z'),
  durationMinutes: 60,
  deliveryMethod: 'ONLINE' as const,
  courseDate: new Date('2026-06-01T00:00:00.000Z'),
  isActive: true,
}

let slugCounter = 0
async function makeCourse(overrides: Partial<Parameters<typeof prisma.course.create>[0]['data']> = {}) {
  slugCounter += 1
  const slug = `${MARKER}-${Date.now()}-${slugCounter}`
  const course = await prisma.course.create({
    data: { ...courseDefaults, name: slug, slug, ...overrides },
  })
  courseIds.push(course.id)
  return course
}

let emailCounter = 0
function makeInput(courseId: string, overrides: Partial<Parameters<typeof registerForCourse>[0]> = {}) {
  emailCounter += 1
  const email = `${MARKER}-${Date.now()}-${emailCounter}@test.local`
  teacherEmails.push(email)
  return {
    courseId,
    fullName: 'Test Teacher',
    email,
    phone: '+201000000000',
    schoolName: `${MARKER} School`,
    subject: 'Mathematics',
    grade: 'Grade 3',
    address: null,
    marketingConsent: false,
    promoCode: null,
    ip: '127.0.0.1',
    userAgent: 'vitest-test-agent',
    ...overrides,
  }
}

let codeCounter = 0
function randomCode(): string {
  codeCounter += 1
  return `RFCTEST${Date.now().toString(36)}${codeCounter}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function makePromoCode(overrides: Partial<Parameters<typeof prisma.promoCode.create>[0]['data']> = {}) {
  const promoCode = await prisma.promoCode.create({
    data: {
      code: randomCode(),
      description: MARKER,
      discountType: 'PERCENTAGE',
      discountValue: 20,
      appliesToAllCourses: true,
      ...overrides,
    },
  })
  promoCodeIds.push(promoCode.id)
  return promoCode
}

afterEach(() => {
  sendConfirmedEmail.mockClear()
  sendWaitlistedEmail.mockClear()
  sendConfirmedEmail.mockResolvedValue('email-id')
  sendWaitlistedEmail.mockResolvedValue('email-id')
})

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { courseId: { in: courseIds } } })
  await prisma.consentEvent.deleteMany({ where: { subscriber: { emailNormalised: { in: teacherEmails } } } })
  await prisma.subscriber.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.school.deleteMany({ where: { canonicalName: { startsWith: MARKER } } })
  await prisma.promoCodeCourse.deleteMany({ where: { promoCodeId: { in: promoCodeIds } } })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.$disconnect()
})

describe('registerForCourse', () => {
  it('confirms a valid registration with no capacity limit', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const outcome = await registerForCourse(makeInput(course.id))

    expect(outcome.status).toBe('CONFIRMED')
    expect(outcome.reference).toMatch(/^EDU-\d{4}-[A-Z0-9]{6}$/)

    const saved = await prisma.registration.findUnique({ where: { reference: outcome.reference } })
    expect(saved?.status).toBe('CONFIRMED')
    expect(sendConfirmedEmail).toHaveBeenCalledOnce()
  })

  it('shows the session dates for a multi-day course, on both the confirmation screen and the confirmation email', async () => {
    const sessionDates = [new Date('2026-09-05T00:00:00.000Z'), new Date('2026-09-12T00:00:00.000Z')]
    const course = await makeCourse({
      maxCapacity: null,
      isMultiDay: true,
      durationMinutes: null,
      courseDate: sessionDates[0]!,
      sessions: { create: sessionDates.map((sessionDate) => ({ sessionDate })) },
    })
    const outcome = await registerForCourse(makeInput(course.id))

    expect(outcome.status).toBe('CONFIRMED')
    if (outcome.status !== 'CONFIRMED') return
    expect(outcome.courseDateLong).toBe('5 and 12 September 2026, 2 sessions')

    expect(sendConfirmedEmail).toHaveBeenCalledOnce()
    const emailParams = sendConfirmedEmail.mock.calls[0]![1] as { courseDateLong: string }
    expect(emailParams.courseDateLong).toBe('5 and 12 September 2026, 2 sessions')
  })

  it('blocks a duplicate registration for the same course and email, naming the existing reference', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id)
    const first = await registerForCourse(input)

    await expect(registerForCourse(input)).rejects.toThrow(RegistrationRejectedError)
    await expect(registerForCourse(input)).rejects.toThrow('already registered for this course')
    await expect(registerForCourse(input)).rejects.toThrow(first.reference)
  })

  it('a duplicate attempt against an existing WAITLISTED registration says "waiting list", not "registered"', async () => {
    const course = await makeCourse({ maxCapacity: 1, waitlistEnabled: true, waitlistCapacity: 5 })
    await registerForCourse(makeInput(course.id)) // fills the one confirmed seat
    const input = makeInput(course.id)
    const waitlisted = await registerForCourse(input)
    expect(waitlisted.status).toBe('WAITLISTED')

    await expect(registerForCourse(input)).rejects.toThrow('already on the waiting list for this course')
    await expect(registerForCourse(input)).rejects.toThrow(waitlisted.reference)
  })

  // Defect 6: Registration has @@unique([courseId, teacherId]) — the
  // database enforces one row per teacher per course regardless of status.
  // The pre-existing "already registered" check explicitly treats a
  // CANCELLED registration as not blocking, but a second create() for the
  // same pair was always rejected by the database anyway (P2002), which
  // used to escape uncaught as a raw Prisma error. Re-registering after a
  // cancellation must actually work, not just fail with a nicer message.
  it('re-registering for the same course after cancelling reactivates the same row and reference, rather than erroring', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id)
    const original = await registerForCourse(input)
    await prisma.registration.update({ where: { reference: original.reference }, data: { status: 'CANCELLED', cancelledAt: new Date() } })

    const again = await registerForCourse(input)

    expect(again.status).toBe('CONFIRMED')
    expect(again.reference).toBe(original.reference) // same row reactivated, not a second one

    // Defect: reference stays the same on reactivation, so without
    // something to distinguish them, conversionEventId would produce the
    // exact same event_id as the original send — Meta's own dedup would
    // then silently discard this second, genuinely new conversion as a
    // repeat of the first. Both ids still start with the shared
    // reference:eventName prefix; only a reactivation gets a distinguishing
    // suffix appended.
    expect(again.eventId).not.toBe(original.eventId)
    expect(original.eventId).toBe(`${original.reference}:CompleteRegistration`)
    expect(again.eventId.startsWith(`${again.reference}:CompleteRegistration:`)).toBe(true)

    const rows = await prisma.registration.findMany({ where: { courseId: course.id, teacherId: (await prisma.teacher.findUniqueOrThrow({ where: { emailNormalised: input.email.toLowerCase() } })).id } })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('CONFIRMED')
    expect(rows[0]!.cancelledAt).toBeNull()
    // A fresh confirmation email was sent and recorded for the reactivation
    // itself — not just carried over from the original, cancelled send.
    expect(rows[0]!.emailStatus).toBe('SENT')
    expect(sendConfirmedEmail).toHaveBeenCalledTimes(2) // once for the original registration, once for the reactivation
  })

  it('re-registering after cancellation still respects current capacity — it can land on the waitlist', async () => {
    const course = await makeCourse({ maxCapacity: 1, waitlistEnabled: true, waitlistCapacity: 5 })
    const input = makeInput(course.id)
    const original = await registerForCourse(input)
    expect(original.status).toBe('CONFIRMED')
    await prisma.registration.update({ where: { reference: original.reference }, data: { status: 'CANCELLED', cancelledAt: new Date() } })

    // Someone else takes the now-open seat before the original teacher comes back.
    await registerForCourse(makeInput(course.id))

    const again = await registerForCourse(input)
    expect(again.status).toBe('WAITLISTED')
    expect(again.reference).toBe(original.reference)
  })

  it('two simultaneous submissions for the same new teacher and course produce exactly one success, not a raw database error', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id)

    const results = await Promise.allSettled([registerForCourse(input), registerForCourse(input)])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RegistrationRejectedError)
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('already registered for this course')

    const totalRegistrations = await prisma.registration.count({ where: { courseId: course.id } })
    expect(totalRegistrations).toBe(1)
  }, 20_000)

  it('two simultaneous submissions for the same new teacher email but different courses both succeed', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(courseA.id)

    const results = await Promise.allSettled([registerForCourse(input), registerForCourse({ ...input, courseId: courseB.id })])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(rejected).toHaveLength(0)
    expect(fulfilled).toHaveLength(2)

    const teachers = await prisma.teacher.findMany({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(teachers).toHaveLength(1)

    const registrations = await prisma.registration.findMany({ where: { teacherId: teachers[0]!.id } })
    expect(registrations).toHaveLength(2)
    expect(registrations.map((registration) => registration.courseId).sort()).toEqual([courseA.id, courseB.id].sort())
  }, 20_000)

  it('reuses the same teacher record when the same email registers for a different course', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(courseA.id)

    await registerForCourse(input)
    await registerForCourse({ ...input, courseId: courseB.id })

    const teachers = await prisma.teacher.findMany({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(teachers).toHaveLength(1)

    const registrations = await prisma.registration.findMany({ where: { teacherId: teachers[0]!.id } })
    expect(registrations).toHaveLength(2)
  }, 20_000)

  it('rejects registration outside the registration window', async () => {
    const course = await makeCourse({
      maxCapacity: null,
      registrationOpensAt: new Date('2020-01-01T00:00:00.000Z'),
      registrationClosesAt: new Date('2020-01-02T00:00:00.000Z'),
    })

    await expect(registerForCourse(makeInput(course.id))).rejects.toThrow('no longer accepting registrations')
  })

  it('rejects a full course with waitlist disabled', async () => {
    const course = await makeCourse({ maxCapacity: 1, waitlistEnabled: false })
    await registerForCourse(makeInput(course.id))

    await expect(registerForCourse(makeInput(course.id))).rejects.toThrow('This course is now full.')
  })

  it('waitlists registrations once a course with waitlist enabled is full, assigning sequential positions', async () => {
    const course = await makeCourse({ maxCapacity: 1, waitlistEnabled: true, waitlistCapacity: 5 })
    const confirmed = await registerForCourse(makeInput(course.id))
    expect(confirmed.status).toBe('CONFIRMED')

    const first = await registerForCourse(makeInput(course.id))
    expect(first.status).toBe('WAITLISTED')
    if (first.status === 'WAITLISTED') expect(first.waitlistPosition).toBe(1)
    expect(sendWaitlistedEmail).toHaveBeenCalledOnce()

    const second = await registerForCourse(makeInput(course.id))
    expect(second.status).toBe('WAITLISTED')
    if (second.status === 'WAITLISTED') expect(second.waitlistPosition).toBe(2)
  }, 20_000)

  it('rejects once the waitlist itself is at capacity', async () => {
    const course = await makeCourse({ maxCapacity: 1, waitlistEnabled: true, waitlistCapacity: 1 })
    await registerForCourse(makeInput(course.id))
    await registerForCourse(makeInput(course.id))

    await expect(registerForCourse(makeInput(course.id))).rejects.toThrow(
      'This course and its waiting list are both full.',
    )
  }, 20_000)

  it('under two simultaneous submissions for the last seat, exactly one is confirmed and one waitlisted', async () => {
    const course = await makeCourse({ maxCapacity: 1, waitlistEnabled: true, waitlistCapacity: 5 })

    const [a, b] = await Promise.all([
      registerForCourse(makeInput(course.id)),
      registerForCourse(makeInput(course.id)),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(['CONFIRMED', 'WAITLISTED'])

    const confirmedCount = await prisma.registration.count({ where: { courseId: course.id, status: 'CONFIRMED' } })
    expect(confirmedCount).toBe(1)
  }, 20_000)

  it('saves the registration and records emailStatus FAILED when sending the email fails', async () => {
    sendConfirmedEmail.mockRejectedValueOnce(new Error('resend down'))
    const course = await makeCourse({ maxCapacity: null })

    const outcome = await registerForCourse(makeInput(course.id))
    expect(outcome.status).toBe('CONFIRMED')
    expect(outcome.emailStatus).toBe('FAILED')

    const saved = await prisma.registration.findUnique({ where: { reference: outcome.reference } })
    expect(saved).not.toBeNull()
    expect(saved?.emailStatus).toBe('FAILED')
    expect(saved?.emailError).toContain('resend down')
  })

  it('stores consent as false with no timestamp unless explicitly ticked, and true with a timestamp when ticked', async () => {
    const course = await makeCourse({ maxCapacity: null })

    const unticked = await registerForCourse(makeInput(course.id, { marketingConsent: false }))
    const unTickedRow = await prisma.registration.findUnique({ where: { reference: unticked.reference } })
    expect(unTickedRow?.consentGiven).toBe(false)
    expect(unTickedRow?.consentAt).toBeNull()

    const ticked = await registerForCourse(makeInput(course.id, { marketingConsent: true }))
    const tickedRow = await prisma.registration.findUnique({ where: { reference: ticked.reference } })
    expect(tickedRow?.consentGiven).toBe(true)
    expect(tickedRow?.consentAt).not.toBeNull()
  }, 20_000)
})

describe('registerForCourse — subscribers', () => {
  it('creates a subscriber with the correct source, course and wording version when the box is ticked', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id, { marketingConsent: true })

    await registerForCourse(input)

    const subscriber = await prisma.subscriber.findFirst({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscriber?.status).toBe('SUBSCRIBED')
    expect(subscriber?.consentSource).toBe('TRAINING_REGISTRATION')
    expect(subscriber?.consentCourseId).toBe(course.id)
    expect(subscriber?.consentWordingVersion).toBe('v1')
    expect(subscriber?.unsubscribeToken).toBeTruthy()
  })

  it('creates no subscriber when the box is unticked', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id, { marketingConsent: false })

    await registerForCourse(input)

    const subscriber = await prisma.subscriber.findFirst({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscriber).toBeNull()
  })

  it('a second registration by the same email creates no second subscriber', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(courseA.id, { marketingConsent: true })

    await registerForCourse(input)
    await registerForCourse({ ...input, courseId: courseB.id })

    const subscribers = await prisma.subscriber.findMany({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscribers).toHaveLength(1)
    // The subscriber's course/wording snapshot is refreshed to the most recent reaffirmation.
    expect(subscribers[0]?.consentCourseId).toBe(courseB.id)
  }, 20_000)

  it('a subscribed teacher registering again with the box unticked stays subscribed', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(courseA.id, { marketingConsent: true })

    await registerForCourse(input)
    await registerForCourse({ ...input, courseId: courseB.id, marketingConsent: false })

    const subscriber = await prisma.subscriber.findFirst({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscriber?.status).toBe('SUBSCRIBED')
  }, 20_000)

  it('an unsubscribed teacher registering again with the box unticked stays unsubscribed', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(courseA.id, { marketingConsent: true })
    await registerForCourse(input)

    await prisma.subscriber.update({
      where: { emailNormalised: input.email.toLowerCase() },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    })

    await registerForCourse({ ...input, courseId: courseB.id, marketingConsent: false })

    const subscriber = await prisma.subscriber.findFirst({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscriber?.status).toBe('UNSUBSCRIBED')
  }, 20_000)

  it('an unsubscribed teacher registering again with the box ticked is resubscribed and a RESUBSCRIBED event is written', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(courseA.id, { marketingConsent: true })
    await registerForCourse(input)

    await prisma.subscriber.update({
      where: { emailNormalised: input.email.toLowerCase() },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    })

    await registerForCourse({ ...input, courseId: courseB.id, marketingConsent: true })

    const subscriber = await prisma.subscriber.findFirst({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscriber?.status).toBe('SUBSCRIBED')
    expect(subscriber?.unsubscribedAt).toBeNull()

    const events = await prisma.consentEvent.findMany({
      where: { subscriberId: subscriber!.id },
      orderBy: { occurredAt: 'asc' },
    })
    expect(events.map((e) => e.eventType)).toEqual(['SUBSCRIBED', 'RESUBSCRIBED'])
  }, 20_000)

  it('deduplicates across case variants of the same email', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id, { marketingConsent: true })
    const upperEmail = input.email.toUpperCase()

    await registerForCourse(input)
    await registerForCourse({ ...input, email: upperEmail, courseId: courseB.id })

    const subscribers = await prisma.subscriber.findMany({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscribers).toHaveLength(1)
  }, 20_000)

  it('every subscription writes a ConsentEvent, and events are appended rather than mutated', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const input = makeInput(courseA.id, { marketingConsent: true })

    await registerForCourse(input)
    const subscriber = await prisma.subscriber.findFirstOrThrow({ where: { emailNormalised: input.email.toLowerCase() } })
    const firstEvent = await prisma.consentEvent.findFirstOrThrow({ where: { subscriberId: subscriber.id } })

    await registerForCourse({ ...input, courseId: courseB.id, marketingConsent: true })

    const events = await prisma.consentEvent.findMany({ where: { subscriberId: subscriber.id }, orderBy: { occurredAt: 'asc' } })
    expect(events).toHaveLength(2)
    // The first event survives untouched — never updated in place.
    expect(events[0]).toEqual(firstEvent)
    expect(events[1]?.courseId).toBe(courseB.id)
  }, 20_000)
})

describe('registerForCourse — landing page subscriber linking', () => {
  it('links an existing landing page subscriber to the newly resolved teacher, creating no duplicate', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id, { marketingConsent: false })

    await subscribeFromLandingPage({ fullName: 'Landing Person', email: input.email, now: new Date('2026-01-01T00:00:00.000Z') })
    const landingSubscriber = await prisma.subscriber.findUniqueOrThrow({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(landingSubscriber.teacherId).toBeNull()

    await registerForCourse(input)

    const subscribers = await prisma.subscriber.findMany({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscribers).toHaveLength(1)

    const teacher = await prisma.teacher.findUniqueOrThrow({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscribers[0]!.id).toBe(landingSubscriber.id)
    expect(subscribers[0]!.teacherId).toBe(teacher.id)
  }, 20_000)

  it('links even when the registration checkbox is left unticked', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id, { marketingConsent: false })
    await subscribeFromLandingPage({ fullName: 'Landing Person', email: input.email, now: new Date() })

    await registerForCourse(input)

    const teacher = await prisma.teacher.findUniqueOrThrow({ where: { emailNormalised: input.email.toLowerCase() } })
    const subscriber = await prisma.subscriber.findUniqueOrThrow({ where: { emailNormalised: input.email.toLowerCase() } })
    expect(subscriber.teacherId).toBe(teacher.id)
    // An unticked box is not a withdrawal of consent — the landing page subscription stays intact.
    expect(subscriber.status).toBe('SUBSCRIBED')
  }, 20_000)

  it('preserves the original subscription date and consent history through linking', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id, { marketingConsent: false })

    const originalSubscribedAt = new Date('2025-06-01T00:00:00.000Z')
    await subscribeFromLandingPage({ fullName: 'Landing Person', email: input.email, now: originalSubscribedAt })
    const landingSubscriber = await prisma.subscriber.findUniqueOrThrow({ where: { emailNormalised: input.email.toLowerCase() } })
    const originalEvents = await prisma.consentEvent.findMany({ where: { subscriberId: landingSubscriber.id } })

    await registerForCourse(input)

    const linked = await prisma.subscriber.findUniqueOrThrow({ where: { id: landingSubscriber.id } })
    expect(linked.subscribedAt.toISOString()).toBe(originalSubscribedAt.toISOString())
    expect(linked.consentSource).toBe('LANDING_PAGE')

    const eventsAfter = await prisma.consentEvent.findMany({ where: { subscriberId: landingSubscriber.id } })
    expect(eventsAfter).toEqual(originalEvents)
  }, 20_000)
})

describe('registerForCourse — promo codes', () => {
  it('applies a valid percentage discount and writes the full snapshot', async () => {
    const course = await makeCourse({ maxCapacity: null, feeAmount: 2000, currency: 'EGP' })
    const promo = await makePromoCode({ discountType: 'PERCENTAGE', discountValue: 20 })

    const outcome = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    expect(outcome.status).toBe('CONFIRMED')
    expect(outcome.promo).toEqual(
      expect.objectContaining({ code: promo.code, discountAmount: 400, originalFee: 2000, finalFee: 1600 }),
    )

    const saved = await prisma.registration.findUnique({ where: { reference: outcome.reference } })
    expect(saved?.promoCodeId).toBe(promo.id)
    expect(saved?.promoCodeSnapshot).toBe(promo.code)
    expect(saved?.discountTypeSnapshot).toBe('PERCENTAGE')
    expect(Number(saved?.discountValueSnapshot)).toBe(20)
    expect(Number(saved?.discountAmount)).toBe(400)
    expect(Number(saved?.originalFee)).toBe(2000)
    expect(Number(saved?.finalFee)).toBe(1600)
    expect(saved?.promoAppliedAt).not.toBeNull()
    // courseFeeSnapshot is untouched by the promo — it's always the full course fee.
    expect(Number(saved?.courseFeeSnapshot)).toBe(2000)
  })

  it('a fixed discount larger than the course fee clamps the final fee to zero, never negative', async () => {
    const course = await makeCourse({ maxCapacity: null, feeAmount: 100, currency: 'EGP' })
    const promo = await makePromoCode({ discountType: 'FIXED_AMOUNT', discountValue: 500, currency: 'EGP' })

    const outcome = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    expect(outcome.promo?.discountAmount).toBe(100)
    expect(outcome.promo?.finalFee).toBe(0)
  })

  it('rejects an unrecognised promo code with the generic message and does not register at full price', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id, { promoCode: 'NOSUCHCODE999' })

    await expect(registerForCourse(input)).rejects.toThrow('Invalid promo code.')
    const saved = await prisma.registration.findFirst({ where: { courseId: course.id } })
    expect(saved).toBeNull()
  })

  it('the total usage limit blocks the next registration', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const promo = await makePromoCode({ maxTotalUses: 1 })

    const first = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    expect(first.status).toBe('CONFIRMED')

    await expect(registerForCourse(makeInput(course.id, { promoCode: promo.code }))).rejects.toThrow(
      'This promo code has reached its usage limit.',
    )
  })

  it('per-teacher limit set to Across all courses blocks a second use on a different course', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    // maxUsesPerTeacherScope defaults to ALL_COURSES — not set explicitly here on purpose.
    const promo = await makePromoCode({ maxUsesPerTeacher: 1 })
    const input = makeInput(courseA.id, { promoCode: promo.code })

    const first = await registerForCourse(input)
    expect(first.status).toBe('CONFIRMED')

    await expect(
      registerForCourse({ ...input, courseId: courseB.id }),
    ).rejects.toThrow('This promo code has already been used with this email address.')
  })

  it('per-teacher limit set to Per course allows a second use on a different course', async () => {
    const courseA = await makeCourse({ maxCapacity: null })
    const courseB = await makeCourse({ maxCapacity: null })
    const promo = await makePromoCode({ maxUsesPerTeacher: 1, maxUsesPerTeacherScope: 'PER_COURSE' })
    const input = makeInput(courseA.id, { promoCode: promo.code })

    const first = await registerForCourse(input)
    expect(first.status).toBe('CONFIRMED')

    const second = await registerForCourse({ ...input, courseId: courseB.id })
    expect(second.status).toBe('CONFIRMED')
    expect(second.promo?.code).toBe(promo.code)
  })

  it('per-teacher limit set to Per course still blocks a second use on the same course', async () => {
    const course = await makeCourse({ maxCapacity: null, waitlistEnabled: true, waitlistCapacity: 5 })
    const promo = await makePromoCode({ maxUsesPerTeacher: 1, maxUsesPerTeacherScope: 'PER_COURSE' })
    const input = makeInput(course.id, { promoCode: promo.code })

    const first = await registerForCourse(input)
    expect(first.status).toBe('CONFIRMED')

    // Same email, same course — blocked both by the pre-existing
    // "already registered for this course" rule and (if that check were
    // absent) by the per-teacher promo limit; either way it must reject.
    await expect(registerForCourse(input)).rejects.toThrow()
  })

  it('a different teacher can still use a code that one teacher has exhausted for themselves', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const promo = await makePromoCode({ maxUsesPerTeacher: 1 })

    const teacherA = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    expect(teacherA.status).toBe('CONFIRMED')

    const courseB = await makeCourse({ maxCapacity: null })
    const teacherB = await registerForCourse(makeInput(courseB.id, { promoCode: promo.code }))
    expect(teacherB.status).toBe('CONFIRMED')
    expect(teacherB.promo?.code).toBe(promo.code)
  })

  it('two simultaneous submissions for the final use produce exactly one success', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const promo = await makePromoCode({ maxTotalUses: 1 })

    const results = await Promise.allSettled([
      registerForCourse(makeInput(course.id, { promoCode: promo.code })),
      registerForCourse(makeInput(course.id, { promoCode: promo.code })),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RegistrationRejectedError)

    const confirmedUses = await prisma.registration.count({ where: { promoCodeId: promo.id, status: 'CONFIRMED' } })
    expect(confirmedUses).toBe(1)
    // The losing submission failed entirely — never registered at full price.
    const totalRegistrationsForCourse = await prisma.registration.count({ where: { courseId: course.id } })
    expect(totalRegistrationsForCourse).toBe(1)
  }, 20_000)

  it('a WAITLISTED registration does not consume a use', async () => {
    const course = await makeCourse({ maxCapacity: 1, waitlistEnabled: true, waitlistCapacity: 5 })
    const promo = await makePromoCode({ maxTotalUses: 5 })

    // Fills the course without a promo code, so the second registrant is waitlisted.
    await registerForCourse(makeInput(course.id))

    const waitlisted = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    expect(waitlisted.status).toBe('WAITLISTED')
    expect(waitlisted.promo?.code).toBe(promo.code)

    const saved = await prisma.registration.findUnique({ where: { reference: waitlisted.reference } })
    expect(saved?.promoCodeSnapshot).toBe(promo.code)
    expect(saved?.finalFee).not.toBeNull()

    const confirmedUses = await prisma.registration.count({ where: { promoCodeId: promo.id, status: 'CONFIRMED' } })
    expect(confirmedUses).toBe(0)
  }, 20_000)

  it('cancelling a registration releases the use', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const promo = await makePromoCode({ maxTotalUses: 1 })

    const outcome = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    await prisma.registration.update({
      where: { reference: outcome.reference },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })

    // The snapshot remains on the cancelled record for audit...
    const cancelled = await prisma.registration.findUnique({ where: { reference: outcome.reference } })
    expect(cancelled?.promoCodeSnapshot).toBe(promo.code)

    // ...but the use it held is released, so a new registration can take it.
    const courseB = await makeCourse({ maxCapacity: null })
    const next = await registerForCourse(makeInput(courseB.id, { promoCode: promo.code }))
    expect(next.status).toBe('CONFIRMED')
  })

  it('editing a promo code afterwards does not change any historical registration', async () => {
    const course = await makeCourse({ maxCapacity: null, feeAmount: 1000 })
    const promo = await makePromoCode({ discountType: 'PERCENTAGE', discountValue: 10 })

    const outcome = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    expect(outcome.promo?.discountAmount).toBe(100)

    await prisma.promoCode.update({ where: { id: promo.id }, data: { discountValue: 90, description: 'edited' } })

    const saved = await prisma.registration.findUnique({ where: { reference: outcome.reference } })
    expect(Number(saved?.discountValueSnapshot)).toBe(10)
    expect(Number(saved?.discountAmount)).toBe(100)
    expect(Number(saved?.finalFee)).toBe(900)
  })

  it('archiving a promo code afterwards does not change any historical registration', async () => {
    const course = await makeCourse({ maxCapacity: null, feeAmount: 1000 })
    const promo = await makePromoCode({ discountType: 'PERCENTAGE', discountValue: 10 })

    const outcome = await registerForCourse(makeInput(course.id, { promoCode: promo.code }))
    await prisma.promoCode.update({ where: { id: promo.id }, data: { archivedAt: new Date() } })

    const saved = await prisma.registration.findUnique({ where: { reference: outcome.reference } })
    expect(saved?.promoCodeSnapshot).toBe(promo.code)
    expect(Number(saved?.finalFee)).toBe(900)
  })
})
