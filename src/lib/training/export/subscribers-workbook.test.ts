import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '../prisma'
import { generateUnsubscribeToken } from '../unsubscribe-token'
import { buildSubscribersWorkbook } from './subscribers-workbook'

// Self-contained and self-cleaning, following the pattern in registrations-workbook.test.ts.
const MARKER = 'subscribers-export-workbook-test'
const teacherIds: string[] = []

async function makeSubscriber(status: 'SUBSCRIBED' | 'UNSUBSCRIBED', index: number) {
  const email = `${MARKER}-${index}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${index}`,
      phone: `+2010000000${index}`,
      phoneNormalised: `+2010000000${index}`,
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      marketingConsent: false,
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
  teacherIds.push(teacher.id)

  const now = new Date()
  await prisma.subscriber.create({
    data: {
      teacherId: teacher.id,
      emailNormalised: email,
      status,
      subscribedAt: now,
      unsubscribedAt: status === 'UNSUBSCRIBED' ? now : null,
      consentSource: 'TRAINING_REGISTRATION',
      consentWordingVersion: 'v1',
      unsubscribeToken: generateUnsubscribeToken(),
      marketingEmailsSent: 2,
      lastMarketingEmailAt: now,
    },
  })
}

beforeAll(async () => {
  await makeSubscriber('SUBSCRIBED', 1)
  await makeSubscriber('SUBSCRIBED', 2)
  await makeSubscriber('UNSUBSCRIBED', 3)
}, 30_000)

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { teacherId: { in: teacherIds } } } })
  await prisma.subscriber.deleteMany({ where: { teacherId: { in: teacherIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.$disconnect()
})

describe('buildSubscribersWorkbook', () => {
  it('defaults to subscribed-only, producing a valid, openable workbook with the expected columns and row counts', async () => {
    const { workbook, rowCount } = await buildSubscribersWorkbook({ status: 'SUBSCRIBED', search: MARKER })

    expect(rowCount).toBe(2)

    const buffer = await workbook.xlsx.writeBuffer()
    const reloaded = new ExcelJS.Workbook()
    await reloaded.xlsx.load(buffer as unknown as ArrayBuffer)

    const sheet = reloaded.getWorksheet('Subscribers')!
    // Row 1 is the header; data starts at row 2.
    expect(sheet.rowCount).toBe(1 + rowCount)
    expect(sheet.getRow(1).getCell(1).value).toBe('Name')
    expect(sheet.getRow(1).getCell(7).value).toBe('Subscription Status')

    const emails = Array.from({ length: rowCount }, (_, i) => sheet.getRow(i + 2).getCell(2).value)
    expect(emails).toContain(`${MARKER}-1@test.local`)
    expect(emails).toContain(`${MARKER}-2@test.local`)
    expect(emails).not.toContain(`${MARKER}-3@test.local`)
  })

  it('includes unsubscribed contacts only when the filter deliberately asks for them', async () => {
    const { rowCount } = await buildSubscribersWorkbook({ status: 'ALL', search: MARKER })
    expect(rowCount).toBe(3)
  })
})
