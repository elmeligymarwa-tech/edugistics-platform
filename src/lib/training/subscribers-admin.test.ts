import { afterAll, describe, expect, it } from 'vitest'

import { normaliseSchoolNameKey } from './normalise'
import { generateUnsubscribeToken } from './unsubscribe-token'

const {
  listSubscribersForAdmin,
  listAllSubscribersForExport,
  resolveSubscriberSelection,
  getSubscriberDetail,
} = await import('./subscribers-admin')
const { prisma } = await import('./prisma')

// Self-contained and self-cleaning, following the pattern in register-for-course.test.ts.
const MARKER = 'subscribers-admin-test'
const teacherIds: string[] = []
const landingSubscriberIds: string[] = []
const schoolIds: string[] = []
const courseIds: string[] = []

async function makeSchool(name: string) {
  const school = await prisma.school.create({ data: { canonicalName: name, nameKey: normaliseSchoolNameKey(name) } })
  schoolIds.push(school.id)
  return school
}

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

let courseCounter = 0
async function makeCourse() {
  courseCounter += 1
  const slug = `${MARKER}-${Date.now()}-${courseCounter}`
  const course = await prisma.course.create({ data: { ...courseDefaults, name: slug, slug } })
  courseIds.push(course.id)
  return course
}

let teacherCounter = 0
async function makeSubscriber(overrides: {
  schoolId: string
  schoolName: string
  subject?: string
  grade?: string
  status?: 'SUBSCRIBED' | 'UNSUBSCRIBED'
  subscribedAt?: Date
  consentCourseId?: string | null
  consentSource?: 'TRAINING_REGISTRATION' | 'ADMIN_MANUAL' | 'MIGRATED'
}) {
  teacherCounter += 1
  const email = `${MARKER}-${Date.now()}-${teacherCounter}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${teacherCounter}`,
      phone: '+201000000000',
      phoneNormalised: '+201000000000',
      schoolId: overrides.schoolId,
      schoolNameOriginal: overrides.schoolName,
      subjectOriginal: overrides.subject ?? 'Mathematics',
      subjectNormalised: (overrides.subject ?? 'Mathematics').toLowerCase(),
      gradeOriginal: overrides.grade ?? 'Grade 3',
      gradeNormalised: (overrides.grade ?? 'Grade 3').toLowerCase(),
      marketingConsent: false,
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
  teacherIds.push(teacher.id)

  const subscribedAt = overrides.subscribedAt ?? new Date()
  const status = overrides.status ?? 'SUBSCRIBED'
  const subscriber = await prisma.subscriber.create({
    data: {
      teacherId: teacher.id,
      emailNormalised: email,
      status,
      subscribedAt,
      unsubscribedAt: status === 'UNSUBSCRIBED' ? subscribedAt : null,
      consentSource: overrides.consentSource ?? 'TRAINING_REGISTRATION',
      consentCourseId: overrides.consentCourseId ?? null,
      consentWordingVersion: 'v1',
      unsubscribeToken: generateUnsubscribeToken(),
    },
  })
  return { teacher, subscriber }
}

async function makeLandingPageSubscriber(overrides: { status?: 'SUBSCRIBED' | 'UNSUBSCRIBED' } = {}) {
  teacherCounter += 1
  const email = `${MARKER}-landing-${Date.now()}-${teacherCounter}@test.local`
  const subscriber = await prisma.subscriber.create({
    data: {
      teacherId: null,
      emailNormalised: email,
      fullName: `${MARKER} Landing Person ${teacherCounter}`,
      emailOriginal: email,
      status: overrides.status ?? 'SUBSCRIBED',
      subscribedAt: new Date(),
      consentSource: 'LANDING_PAGE',
      consentWordingVersion: 'v2',
      unsubscribeToken: generateUnsubscribeToken(),
    },
  })
  landingSubscriberIds.push(subscriber.id)
  return subscriber
}

afterAll(async () => {
  await prisma.consentEvent.deleteMany({ where: { subscriber: { teacherId: { in: teacherIds } } } })
  await prisma.subscriber.deleteMany({ where: { teacherId: { in: teacherIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.consentEvent.deleteMany({ where: { subscriberId: { in: landingSubscriberIds } } })
  await prisma.subscriber.deleteMany({ where: { id: { in: landingSubscriberIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } })
  await prisma.$disconnect()
})

describe('listSubscribersForAdmin — filters', () => {
  it('school filter returns only that school\'s subscribers', async () => {
    const schoolA = await makeSchool(`${MARKER} School A ${Date.now()}`)
    const schoolB = await makeSchool(`${MARKER} School B ${Date.now()}`)
    const { subscriber: inA } = await makeSubscriber({ schoolId: schoolA.id, schoolName: schoolA.canonicalName })
    const { subscriber: inB } = await makeSubscriber({ schoolId: schoolB.id, schoolName: schoolB.canonicalName })

    const { rows } = await listSubscribersForAdmin({ status: 'ALL', schoolId: schoolA.id }, 0)
    const ids = rows.map((row) => row.id)
    expect(ids).toContain(inA.id)
    expect(ids).not.toContain(inB.id)
  })

  it('subject filter returns only that subject\'s subscribers', async () => {
    const school = await makeSchool(`${MARKER} School Subj ${Date.now()}`)
    const { subscriber: maths } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, subject: 'Mathematics' })
    const { subscriber: physics } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, subject: 'Physics' })

    const { rows } = await listSubscribersForAdmin({ status: 'ALL', subject: 'mathematics' }, 0)
    const ids = rows.map((row) => row.id)
    expect(ids).toContain(maths.id)
    expect(ids).not.toContain(physics.id)
  })

  it('grade filter returns only that grade\'s subscribers', async () => {
    const school = await makeSchool(`${MARKER} School Grade ${Date.now()}`)
    const { subscriber: grade3 } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, grade: 'Grade 3' })
    const { subscriber: grade5 } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, grade: 'Grade 5' })

    const { rows } = await listSubscribersForAdmin({ status: 'ALL', grade: 'grade 3' }, 0)
    const ids = rows.map((row) => row.id)
    expect(ids).toContain(grade3.id)
    expect(ids).not.toContain(grade5.id)
  })

  it('course filter returns only subscribers who subscribed from that course', async () => {
    const school = await makeSchool(`${MARKER} School Course ${Date.now()}`)
    const courseA = await makeCourse()
    const courseB = await makeCourse()
    const { subscriber: fromA } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, consentCourseId: courseA.id })
    const { subscriber: fromB } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, consentCourseId: courseB.id })

    const { rows } = await listSubscribersForAdmin({ status: 'ALL', consentCourseId: courseA.id }, 0)
    const ids = rows.map((row) => row.id)
    expect(ids).toContain(fromA.id)
    expect(ids).not.toContain(fromB.id)
  })

  it('date filter returns only subscribers subscribed within range', async () => {
    const school = await makeSchool(`${MARKER} School Date ${Date.now()}`)
    const { subscriber: inRange } = await makeSubscriber({
      schoolId: school.id,
      schoolName: school.canonicalName,
      subscribedAt: new Date('2026-02-15T00:00:00.000Z'),
    })
    const { subscriber: outOfRange } = await makeSubscriber({
      schoolId: school.id,
      schoolName: school.canonicalName,
      subscribedAt: new Date('2020-01-01T00:00:00.000Z'),
    })

    const { rows } = await listSubscribersForAdmin(
      { status: 'ALL', dateFrom: new Date('2026-02-01T00:00:00.000Z'), dateTo: new Date('2026-02-28T23:59:59.000Z') },
      0,
    )
    const ids = rows.map((row) => row.id)
    expect(ids).toContain(inRange.id)
    expect(ids).not.toContain(outOfRange.id)
  })

  it('combined filters return the intersection, not the union', async () => {
    const schoolA = await makeSchool(`${MARKER} Combined A ${Date.now()}`)
    const schoolB = await makeSchool(`${MARKER} Combined B ${Date.now()}`)
    const { subscriber: match } = await makeSubscriber({ schoolId: schoolA.id, schoolName: schoolA.canonicalName, subject: 'Mathematics' })
    const { subscriber: wrongSchool } = await makeSubscriber({ schoolId: schoolB.id, schoolName: schoolB.canonicalName, subject: 'Mathematics' })
    const { subscriber: wrongSubject } = await makeSubscriber({ schoolId: schoolA.id, schoolName: schoolA.canonicalName, subject: 'Physics' })

    const { rows } = await listSubscribersForAdmin({ status: 'ALL', schoolId: schoolA.id, subject: 'mathematics' }, 0)
    const ids = rows.map((row) => row.id)
    expect(ids).toContain(match.id)
    expect(ids).not.toContain(wrongSchool.id)
    expect(ids).not.toContain(wrongSubject.id)
  })

  it('status filter defaults exclude unsubscribed contacts unless ALL is requested', async () => {
    const school = await makeSchool(`${MARKER} Status ${Date.now()}`)
    const { subscriber: subscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'SUBSCRIBED' })
    const { subscriber: unsubscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'UNSUBSCRIBED' })

    const { rows: subscribedOnly } = await listSubscribersForAdmin({ status: 'SUBSCRIBED', schoolId: school.id }, 0)
    expect(subscribedOnly.map((r) => r.id)).toContain(subscribed.id)
    expect(subscribedOnly.map((r) => r.id)).not.toContain(unsubscribed.id)

    const { rows: all } = await listSubscribersForAdmin({ status: 'ALL', schoolId: school.id }, 0)
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining([subscribed.id, unsubscribed.id]))
  })
})

describe('resolveSubscriberSelection — server always re-applies subscribed-only', () => {
  it('mode "ids": an unsubscribed id in the client payload is silently excluded', async () => {
    const school = await makeSchool(`${MARKER} SelIds ${Date.now()}`)
    const { subscriber: subscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'SUBSCRIBED' })
    const { subscriber: unsubscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'UNSUBSCRIBED' })

    const resolution = await resolveSubscriberSelection({ mode: 'ids', subscriberIds: [subscribed.id, unsubscribed.id] })
    expect(resolution.subscriberIds).toContain(subscribed.id)
    expect(resolution.subscriberIds).not.toContain(unsubscribed.id)
    expect(resolution.count).toBe(1)
  })

  it('mode "filters": even a client-supplied status of ALL or UNSUBSCRIBED never returns an unsubscribed contact', async () => {
    const school = await makeSchool(`${MARKER} SelFilters ${Date.now()}`)
    const { subscriber: subscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'SUBSCRIBED' })
    const { subscriber: unsubscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'UNSUBSCRIBED' })

    const asAll = await resolveSubscriberSelection({ mode: 'filters', filters: { status: 'ALL', schoolId: school.id } })
    expect(asAll.subscriberIds).toContain(subscribed.id)
    expect(asAll.subscriberIds).not.toContain(unsubscribed.id)

    // Even though the caller claims status: 'UNSUBSCRIBED', the server ignores that and
    // returns whoever is actually subscribed at this school — never the unsubscribed contact,
    // and never an empty result just because the client asked for the wrong status.
    const asUnsubscribed = await resolveSubscriberSelection({ mode: 'filters', filters: { status: 'UNSUBSCRIBED', schoolId: school.id } })
    expect(asUnsubscribed.subscriberIds).not.toContain(unsubscribed.id)
    expect(asUnsubscribed.subscriberIds).toEqual([subscribed.id])
  })

  it('"select all matching filters" excludes records outside the filter', async () => {
    const schoolA = await makeSchool(`${MARKER} SelScope A ${Date.now()}`)
    const schoolB = await makeSchool(`${MARKER} SelScope B ${Date.now()}`)
    const { subscriber: inScope } = await makeSubscriber({ schoolId: schoolA.id, schoolName: schoolA.canonicalName })
    const { subscriber: outOfScope } = await makeSubscriber({ schoolId: schoolB.id, schoolName: schoolB.canonicalName })

    const resolution = await resolveSubscriberSelection({ mode: 'filters', filters: { status: 'SUBSCRIBED', schoolId: schoolA.id } })
    expect(resolution.subscriberIds).toContain(inScope.id)
    expect(resolution.subscriberIds).not.toContain(outOfScope.id)
  })

  it('excludeIds removes specific rows from a "select all" resolution', async () => {
    const school = await makeSchool(`${MARKER} SelExclude ${Date.now()}`)
    const { subscriber: kept } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName })
    const { subscriber: excluded } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName })

    const resolution = await resolveSubscriberSelection({
      mode: 'filters',
      filters: { status: 'SUBSCRIBED', schoolId: school.id },
      excludeIds: [excluded.id],
    })
    expect(resolution.subscriberIds).toContain(kept.id)
    expect(resolution.subscriberIds).not.toContain(excluded.id)
  })
})

describe('listAllSubscribersForExport', () => {
  it('respects the filters passed to it', async () => {
    const school = await makeSchool(`${MARKER} Export ${Date.now()}`)
    const { subscriber: subscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'SUBSCRIBED' })
    const { subscriber: unsubscribed } = await makeSubscriber({ schoolId: school.id, schoolName: school.canonicalName, status: 'UNSUBSCRIBED' })

    const subscribedOnly = await listAllSubscribersForExport({ status: 'SUBSCRIBED', schoolId: school.id })
    expect(subscribedOnly.map((r) => r.id)).toContain(subscribed.id)
    expect(subscribedOnly.map((r) => r.id)).not.toContain(unsubscribed.id)

    const everyone = await listAllSubscribersForExport({ status: 'ALL', schoolId: school.id })
    expect(everyone.map((r) => r.id)).toEqual(expect.arrayContaining([subscribed.id, unsubscribed.id]))
  })
})

describe('landing page subscribers with no teacher', () => {
  it('the admin table renders them without breaking — school, subject and grade come back blank rather than throwing', async () => {
    const landing = await makeLandingPageSubscriber()

    const { rows } = await listSubscribersForAdmin({ status: 'SUBSCRIBED' }, 0)
    const row = rows.find((r) => r.id === landing.id)
    expect(row).toBeDefined()
    expect(row!.teacherId).toBeNull()
    expect(row!.fullName).toBe(landing.fullName)
    expect(row!.email).toBe(landing.emailOriginal)
    expect(row!.schoolName).toBeNull()
    expect(row!.subject).toBeNull()
    expect(row!.grade).toBeNull()
  })

  it('getSubscriberDetail renders them without breaking', async () => {
    const landing = await makeLandingPageSubscriber()

    const detail = await getSubscriberDetail(landing.id)
    expect(detail).not.toBeNull()
    expect(detail!.teacherId).toBeNull()
    expect(detail!.phone).toBeNull()
    expect(detail!.schoolName).toBeNull()
  })
})

describe('unsubscribeToken never appears in any admin-facing response', () => {
  it('is absent from SubscriberListItem', async () => {
    const landing = await makeLandingPageSubscriber()
    const { rows } = await listSubscribersForAdmin({ status: 'SUBSCRIBED' }, 0)
    const row = rows.find((r) => r.id === landing.id)!
    expect(Object.values(row)).not.toContain(landing.unsubscribeToken)
    expect(JSON.stringify(row)).not.toContain(landing.unsubscribeToken)
  })

  it('is absent from SubscriberDetail', async () => {
    const landing = await makeLandingPageSubscriber()
    const detail = await getSubscriberDetail(landing.id)
    expect(JSON.stringify(detail)).not.toContain(landing.unsubscribeToken)
  })

  it('is absent from the export row shape', async () => {
    const landing = await makeLandingPageSubscriber()
    const rows = await listAllSubscribersForExport({ status: 'SUBSCRIBED', search: landing.emailOriginal! })
    expect(JSON.stringify(rows)).not.toContain(landing.unsubscribeToken)
  })
})
