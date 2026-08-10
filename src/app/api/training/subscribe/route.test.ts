import { afterAll, describe, expect, it } from 'vitest'

const { prisma } = await import('@/lib/training/prisma')
const { POST } = await import('./route')

function makeRequest(body: unknown, ip: string) {
  return new Request('http://localhost/api/training/subscribe', {
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

const MARKER = 'subscribe-route-test'
const teacherEmails: string[] = []

function validBody(overrides: Record<string, unknown> = {}) {
  return { fullName: 'Test Teacher', email: `${MARKER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`, ...overrides }
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { emailNormalised: { in: teacherEmails } } } })
  await prisma.subscriber.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.$disconnect()
})

describe('POST /api/training/subscribe', () => {
  it('creates a subscriber for a valid submission', async () => {
    const body = validBody()
    teacherEmails.push((body.email as string).toLowerCase())

    const response = await POST(makeRequest(body, uniqueIp()))
    expect(response.status).toBe(200)

    const subscriber = await prisma.subscriber.findUnique({ where: { emailNormalised: (body.email as string).toLowerCase() } })
    expect(subscriber?.status).toBe('SUBSCRIBED')
    expect(subscriber?.consentSource).toBe('LANDING_PAGE')
  })

  it('rejects a malformed email', async () => {
    const response = await POST(makeRequest(validBody({ email: 'not-an-email' }), uniqueIp()))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.fieldErrors?.email).toBeDefined()
  })

  it('a honeypot submission creates nothing and returns the exact same success response as a real subscription', async () => {
    const ip = uniqueIp()
    const realBody = validBody()
    teacherEmails.push((realBody.email as string).toLowerCase())
    const realResponse = await POST(makeRequest(realBody, ip))
    const realJson = await realResponse.json()

    const botIp = uniqueIp()
    const botBody = validBody({ website: 'http://spam.example.com' })
    const botResponse = await POST(makeRequest(botBody, botIp))
    const botJson = await botResponse.json()

    expect(botResponse.status).toBe(realResponse.status)
    expect(botJson).toEqual(realJson)

    const created = await prisma.subscriber.findUnique({ where: { emailNormalised: (botBody.email as string).toLowerCase() } })
    expect(created).toBeNull()
  })

  it('rate limits after 3 submissions from the same IP within the window', async () => {
    const ip = uniqueIp()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const body = validBody()
      teacherEmails.push((body.email as string).toLowerCase())
      const response = await POST(makeRequest(body, ip))
      expect(response.status).toBe(200)
    }
    const fourthBody = validBody()
    const fourth = await POST(makeRequest(fourthBody, ip))
    expect(fourth.status).toBe(429)

    const createdFourth = await prisma.subscriber.findUnique({ where: { emailNormalised: (fourthBody.email as string).toLowerCase() } })
    expect(createdFourth).toBeNull()
  })

  it('does not rate limit a different IP', async () => {
    const freshIp = uniqueIp()
    const body = validBody()
    teacherEmails.push((body.email as string).toLowerCase())
    const response = await POST(makeRequest(body, freshIp))
    expect(response.status).toBe(200)
  })

  it('returns the identical response whether the address is new, already subscribed, or previously unsubscribed', async () => {
    const body = validBody()
    const email = (body.email as string).toLowerCase()
    teacherEmails.push(email)

    const first = await POST(makeRequest(body, uniqueIp()))
    const firstJson = await first.json()

    const second = await POST(makeRequest(body, uniqueIp()))
    const secondJson = await second.json()
    expect(secondJson).toEqual(firstJson)

    const subscriber = await prisma.subscriber.findUniqueOrThrow({ where: { emailNormalised: email } })
    await prisma.subscriber.update({ where: { id: subscriber.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } })

    const third = await POST(makeRequest(body, uniqueIp()))
    const thirdJson = await third.json()
    expect(thirdJson).toEqual(firstJson)
  })
})
