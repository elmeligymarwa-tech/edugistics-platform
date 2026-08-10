import { afterAll, describe, expect, it } from 'vitest'

const { prisma } = await import('@/lib/training/prisma')
const { generateUnsubscribeToken } = await import('@/lib/training/unsubscribe-token')
const { POST } = await import('./route')

function makeRequest(body: unknown, ip: string) {
  return new Request('http://localhost/api/training/unsubscribe/resubscribe', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  }) as Parameters<typeof POST>[0]
}

let ipCounter = 0
function uniqueIp() {
  ipCounter += 1
  return `10.4.0.${ipCounter}`
}

const MARKER = 'unsubscribe-resubscribe-route-test'
const teacherEmails: string[] = []

async function makeSubscriber() {
  const email = `${MARKER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`
  teacherEmails.push(email)
  const now = new Date()
  return prisma.subscriber.create({
    data: {
      teacherId: null,
      emailNormalised: email,
      fullName: 'Test Person',
      emailOriginal: email,
      status: 'UNSUBSCRIBED',
      subscribedAt: now,
      unsubscribedAt: now,
      consentSource: 'LANDING_PAGE',
      consentWordingVersion: 'v2',
      unsubscribeToken: generateUnsubscribeToken(),
    },
  })
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { emailNormalised: { in: teacherEmails } } } })
  await prisma.subscriber.deleteMany({ where: { emailNormalised: { in: teacherEmails } } })
  await prisma.$disconnect()
})

describe('POST /api/training/unsubscribe/resubscribe', () => {
  it('resubscribes a valid token', async () => {
    const subscriber = await makeSubscriber()
    const response = await POST(makeRequest({ token: subscriber.unsubscribeToken }, uniqueIp()))
    expect(response.status).toBe(200)

    const updated = await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriber.id } })
    expect(updated.status).toBe('SUBSCRIBED')
  })

  it('shows a neutral message for an invalid token', async () => {
    const response = await POST(makeRequest({ token: 'not-a-real-token' }, uniqueIp()))
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error).toBe('This unsubscribe link is not valid.')
  })
})
