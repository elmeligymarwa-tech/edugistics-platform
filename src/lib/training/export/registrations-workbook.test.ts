import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '../prisma'
import { buildRegistrationsWorkbook } from './registrations-workbook'

// Self-contained and self-cleaning, hitting the real database like the
// other integration suites in this module.
const MARKER = 'export-workbook-test'
let courseId: string
let teacherIds: string[] = []

beforeAll(async () => {
  const course = await prisma.course.create({
    data: {
      name: `${MARKER} Course`,
      slug: `${MARKER}-course`,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'ASSESSMENT',
      courseDate: new Date('2026-07-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      maxCapacity: 10,
      isActive: true,
    },
  })
  courseId = course.id

  const school = await prisma.school.create({
    data: { canonicalName: `${MARKER} School`, nameKey: `${MARKER}-school` },
  })

  const teachers = await Promise.all(
    Array.from({ length: 3 }, (_, i) =>
      prisma.teacher.create({
        data: {
          emailNormalised: `${MARKER}-${i}@test.local`,
          emailOriginal: `${MARKER}-${i}@test.local`,
          fullName: `${MARKER} Teacher ${i}`,
          phone: `+2010000000${i}`,
          phoneNormalised: `+2010000000${i}`,
          schoolId: school.id,
          schoolNameOriginal: school.canonicalName,
          subjectOriginal: 'Mathematics',
          subjectNormalised: 'mathematics',
          gradeOriginal: 'Grade 3',
          gradeNormalised: 'grade 3',
          marketingConsent: i === 0,
          firstRegisteredAt: new Date(),
          lastRegisteredAt: new Date(),
        },
      }),
    ),
  )
  teacherIds = teachers.map((t) => t.id)

  await prisma.registration.createMany({
    data: [
      {
        reference: `${MARKER}-1`,
        teacherId: teacherIds[0]!,
        courseId,
        courseNameSnapshot: course.name,
        courseDateSnapshot: course.courseDate,
        courseFeeSnapshot: 0,
        courseCurrencySnapshot: 'EGP',
        status: 'CONFIRMED',
        emailType: 'CONFIRMED',
        emailStatus: 'SENT',
      },
      {
        reference: `${MARKER}-2`,
        teacherId: teacherIds[1]!,
        courseId,
        courseNameSnapshot: course.name,
        courseDateSnapshot: course.courseDate,
        courseFeeSnapshot: 0,
        courseCurrencySnapshot: 'EGP',
        status: 'WAITLISTED',
        waitlistPosition: 1,
        emailType: 'WAITLISTED',
        emailStatus: 'SENT',
      },
      {
        reference: `${MARKER}-3`,
        teacherId: teacherIds[2]!,
        courseId,
        courseNameSnapshot: course.name,
        courseDateSnapshot: course.courseDate,
        courseFeeSnapshot: 0,
        courseCurrencySnapshot: 'EGP',
        status: 'CANCELLED',
        emailType: 'CONFIRMED',
        cancelledAt: new Date(),
      },
    ],
  })
}, 30_000)

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { reference: { startsWith: MARKER } } })
  await prisma.teacher.deleteMany({ where: { emailNormalised: { startsWith: MARKER } } })
  await prisma.course.deleteMany({ where: { slug: `${MARKER}-course` } })
  await prisma.school.deleteMany({ where: { nameKey: `${MARKER}-school` } })
  await prisma.$disconnect()
})

describe('buildRegistrationsWorkbook', () => {
  it('produces a workbook exceljs can read back, with the expected sheets and row counts', async () => {
    const { workbook, rowCount } = await buildRegistrationsWorkbook({ courseId })

    // The export mirrors the admin registrations table: with no status
    // filter applied, all 3 rows (including the cancelled one) are present.
    expect(rowCount).toBe(3)

    const sheetNames = workbook.worksheets.map((s) => s.name)
    expect(sheetNames).toEqual(['Registrations', 'Teachers', 'Schools', 'Course Performance'])

    const registrationsSheet = workbook.getWorksheet('Registrations')!
    // Row 1 is the header; data starts at row 2.
    expect(registrationsSheet.rowCount).toBe(1 + rowCount)
    expect(registrationsSheet.getRow(1).getCell(1).value).toBe('Registration Date')

    const buffer = await workbook.xlsx.writeBuffer()
    const reloaded = new ExcelJS.Workbook()
    await reloaded.xlsx.load(buffer as unknown as ArrayBuffer)
    expect(reloaded.getWorksheet('Registrations')!.rowCount).toBe(1 + rowCount)
  })

  it('respects an active status filter, matching the count reflected in the admin table', async () => {
    const { rowCount } = await buildRegistrationsWorkbook({ courseId, status: 'CONFIRMED' })
    expect(rowCount).toBe(1)
  })
})
