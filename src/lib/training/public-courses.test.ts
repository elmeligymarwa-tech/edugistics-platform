import { afterAll, describe, expect, it } from 'vitest'

import { listPublicCourses } from './public-courses'
import { prisma } from './prisma'

// Guards the public /training registration page's data boundary: a course
// with a Zoom link, meeting id and passcode set must never surface any of
// those fields (or any campaign/communication data) in the shape a real
// visitor's browser receives.
const MARKER = 'public-courses-test'
const courseIds: string[] = []

afterAll(async () => {
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('listPublicCourses', () => {
  it('never includes zoomLink, zoomMeetingId, zoomPasscode or any campaign/communication field', async () => {
    const course = await prisma.course.create({
      data: {
        name: `${MARKER} course`,
        slug: `${MARKER}-${Date.now()}`,
        shortDescription: 'x',
        fullDescription: 'x',
        category: 'LEADERSHIP',
        courseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startTime: new Date('1970-01-01T09:00:00.000Z'),
        endTime: new Date('1970-01-01T10:00:00.000Z'),
        durationMinutes: 60,
        deliveryMethod: 'ONLINE',
        isActive: true,
        zoomLink: 'https://zoom.us/j/secret',
        zoomMeetingId: '999 888 7777',
        zoomPasscode: 'topsecret',
        reminderSubject: 'Internal reminder subject',
        reminderMessage: 'Internal reminder body',
      },
    })
    courseIds.push(course.id)

    const courses = await listPublicCourses()
    const found = courses.find((c) => c.id === course.id)
    expect(found).toBeDefined()

    const serialised = JSON.stringify(found)
    expect(serialised).not.toContain('zoom')
    expect(serialised).not.toContain('secret')
    expect(serialised).not.toContain('topsecret')
    expect(serialised).not.toContain('Internal reminder')

    const keys = Object.keys(found!)
    for (const forbidden of ['zoomLink', 'zoomMeetingId', 'zoomPasscode', 'reminderSubject', 'reminderMessage']) {
      expect(keys).not.toContain(forbidden)
    }
  })
})
