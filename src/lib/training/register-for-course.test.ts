import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

const sendConfirmedEmail = vi.fn().mockResolvedValue('email-id')
const sendWaitlistedEmail = vi.fn().mockResolvedValue('email-id')

vi.mock('./email/send-registration-email', () => ({
  sendConfirmedEmail: (...args: unknown[]) => sendConfirmedEmail(...args),
  sendWaitlistedEmail: (...args: unknown[]) => sendWaitlistedEmail(...args),
}))

const { registerForCourse, RegistrationRejectedError } = await import('./register-for-course')
const { prisma } = await import('./prisma')

// Self-contained and self-cleaning, following the pattern in registrations.test.ts.
// Hits the real database configured via DATABASE_URL — the capacity/waitlist
// logic runs inside a row-locked transaction, so there is no mockable
// boundary between this module and Postgres for the race-condition test.
const MARKER = 'register-for-course-test'
const courseIds: string[] = []
const teacherEmails: string[] = []

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
    ip: '127.0.0.1',
    ...overrides,
  }
}

afterEach(() => {
  sendConfirmedEmail.mockClear()
  sendWaitlistedEmail.mockClear()
  sendConfirmedEmail.mockResolvedValue('email-id')
  sendWaitlistedEmail.mockResolvedValue('email-id')
})

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { courseId: { in: courseIds } } })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.school.deleteMany({ where: { canonicalName: { startsWith: MARKER } } })
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

  it('blocks a duplicate registration for the same course and email', async () => {
    const course = await makeCourse({ maxCapacity: null })
    const input = makeInput(course.id)
    await registerForCourse(input)

    await expect(registerForCourse(input)).rejects.toThrow(RegistrationRejectedError)
    await expect(registerForCourse(input)).rejects.toThrow('already registered for this course')
  })

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
