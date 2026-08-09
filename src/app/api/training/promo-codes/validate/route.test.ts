import { afterAll, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/training/prisma'
import { POST } from './route'

// Self-contained and self-cleaning, following the pattern in
// api/training/register/route.test.ts — hits the real database.
const MARKER = 'promo-validate-route-test'
const courseIds: string[] = []
const promoCodeIds: string[] = []

let slugCounter = 0
async function makeCourse(overrides: Partial<Parameters<typeof prisma.course.create>[0]['data']> = {}) {
  slugCounter += 1
  const slug = `${MARKER}-${Date.now()}-${slugCounter}`
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
      feeAmount: 1000,
      currency: 'EGP',
      ...overrides,
    },
  })
  courseIds.push(course.id)
  return course
}

let codeCounter = 0
function randomCode(): string {
  codeCounter += 1
  return `VALROUTETEST${Date.now().toString(36)}${codeCounter}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
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

function makeRequest(body: unknown, ip: string) {
  return new Request('http://localhost/api/training/promo-codes/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  }) as Parameters<typeof POST>[0]
}

let ipCounter = 0
function uniqueIp() {
  ipCounter += 1
  return `10.2.0.${ipCounter}`
}

afterAll(async () => {
  await prisma.promoCodeCourse.deleteMany({ where: { promoCodeId: { in: promoCodeIds } } })
  await prisma.promoCode.deleteMany({ where: { id: { in: promoCodeIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('POST /api/training/promo-codes/validate', () => {
  it('returns the discount breakdown for a valid code', async () => {
    const course = await makeCourse({ feeAmount: 2000 })
    const promo = await makePromoCode({ discountType: 'PERCENTAGE', discountValue: 20 })

    const response = await POST(makeRequest({ code: promo.code, courseId: course.id }, uniqueIp()))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toEqual(
      expect.objectContaining({ code: promo.code, originalFee: 2000, discountAmount: 400, finalFee: 1600 }),
    )
  })

  it('returns the exact generic message for an invalid code, revealing nothing else', async () => {
    const course = await makeCourse()
    const response = await POST(makeRequest({ code: 'NOSUCHCODE999', courseId: course.id }, uniqueIp()))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Invalid promo code.')
  })

  it('resolves lowercase and mixed-case entry to the same code', async () => {
    const course = await makeCourse()
    const promo = await makePromoCode()
    const response = await POST(makeRequest({ code: promo.code.toLowerCase(), courseId: course.id }, uniqueIp()))
    expect(response.status).toBe(200)
  })

  it('rejects a malformed request body', async () => {
    const response = await POST(makeRequest({ code: '' }, uniqueIp()))
    expect(response.status).toBe(400)
  })

  it('rate limits after 20 attempts from the same IP within the window', async () => {
    const course = await makeCourse()
    const ip = uniqueIp()
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await POST(makeRequest({ code: 'NOSUCHCODE999', courseId: course.id }, ip))
      expect(response.status).toBe(400) // invalid code, but rate limit not yet triggered
    }
    const twentyFirst = await POST(makeRequest({ code: 'NOSUCHCODE999', courseId: course.id }, ip))
    expect(twentyFirst.status).toBe(429)
  }, 40_000)

  it('does not rate limit a different IP', async () => {
    const course = await makeCourse()
    const response = await POST(makeRequest({ code: 'NOSUCHCODE999', courseId: course.id }, uniqueIp()))
    expect(response.status).toBe(400)
  })
})
