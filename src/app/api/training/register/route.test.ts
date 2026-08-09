import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/training/email/send-registration-email', () => ({
  sendConfirmedEmail: vi.fn().mockResolvedValue('email-id'),
  sendWaitlistedEmail: vi.fn().mockResolvedValue('email-id'),
}))

const { prisma } = await import('@/lib/training/prisma')
const { POST } = await import('./route')

// Uses a non-existent (but well-formed) courseId so each call reaches
// registerForCourse's real-database row-lock check and rejects with 409
// before writing anything — enough to exercise the rate limiter honestly
// without creating registration rows.
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'rate-limit-test-nonexistent-course',
    fullName: 'Test Teacher',
    email: 'rate-limit-test@test.local',
    phone: '+201000000000',
    schoolName: 'Test School',
    subject: 'Mathematics',
    grade: 'Grade 3',
    marketingConsent: false,
    ...overrides,
  }
}

function makeRequest(body: unknown, ip: string) {
  return new Request('http://localhost/api/training/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  }) as Parameters<typeof POST>[0]
}

let ipCounter = 0
function uniqueIp() {
  ipCounter += 1
  return `10.1.0.${ipCounter}`
}

const MARKER = 'register-route-test'
const courseIds: string[] = []
const promoCodeIds: string[] = []
const teacherEmails: string[] = []

async function makeCourse() {
  const slug = `${MARKER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const course = await prisma.course.create({
    data: {
      name: slug,
      slug,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      isActive: true,
      feeAmount: 2000,
      currency: 'EGP',
    },
  })
  courseIds.push(course.id)
  return course
}

async function makePromoCode() {
  const code = `ROUTETEST${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const promoCode = await prisma.promoCode.create({
    data: { code, description: MARKER, discountType: 'PERCENTAGE', discountValue: 20, appliesToAllCourses: true },
  })
  promoCodeIds.push(promoCode.id)
  return promoCode
}

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { courseId: { in: courseIds } } })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.$disconnect()
})

describe('POST /api/training/register', () => {
  it('rejects each missing required field', async () => {
    const fields = ['courseId', 'fullName', 'email', 'phone', 'schoolName', 'subject', 'grade']
    for (const field of fields) {
      const body = validBody({ [field]: '' })
      const response = await POST(makeRequest(body, uniqueIp()))
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(Object.keys(json.fieldErrors ?? {})).toContain(field)
    }
  })

  it('accepts a missing address — it is optional on the public form', async () => {
    const response = await POST(makeRequest(validBody({ address: undefined }), uniqueIp()))
    // 409 (course not found) proves validation passed and the request reached registerForCourse.
    expect(response.status).toBe(409)
  })

  it('silently drops a submission where the honeypot field is filled', async () => {
    const response = await POST(makeRequest(validBody({ website: 'http://spam.example.com' }), uniqueIp()))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).not.toMatch(/highlighted fields/i)
  })

  it('rate limits after 5 submissions from the same IP within the window', async () => {
    const ip = uniqueIp()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(makeRequest(validBody(), ip))
      expect(response.status).toBe(409) // course not found, but rate limit not yet triggered
    }
    const sixth = await POST(makeRequest(validBody(), ip))
    expect(sixth.status).toBe(429)
  })

  it('does not rate limit a different IP', async () => {
    const freshIp = uniqueIp()
    const response = await POST(makeRequest(validBody(), freshIp))
    expect(response.status).toBe(409) // reaches registerForCourse, not blocked by rate limit
  })

  it('ignores a browser-supplied discount, final fee and course fee entirely — the server computes its own', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode()
    const email = `${MARKER}-${Date.now()}@test.local`
    teacherEmails.push(email)

    const body = {
      courseId: course.id,
      fullName: 'Test Teacher',
      email,
      phone: '+201000000000',
      schoolName: 'Test School',
      subject: 'Mathematics',
      grade: 'Grade 3',
      marketingConsent: false,
      promoCode: promo.code,
      // None of these are real fields on the schema — a malicious client
      // sending them must have zero effect on what gets stored.
      discountAmount: 999999,
      finalFee: 1,
      courseFee: 1,
      originalFee: 1,
    }

    const response = await POST(makeRequest(body, uniqueIp()))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.promo).toEqual(expect.objectContaining({ discountAmount: 400, originalFee: 2000, finalFee: 1600 }))

    const saved = await prisma.registration.findUnique({ where: { reference: json.data.reference } })
    expect(Number(saved?.discountAmount)).toBe(400)
    expect(Number(saved?.originalFee)).toBe(2000)
    expect(Number(saved?.finalFee)).toBe(1600)
  })
})
