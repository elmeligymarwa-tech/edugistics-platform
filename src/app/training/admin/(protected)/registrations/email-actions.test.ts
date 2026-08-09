import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/training/auth/require-admin', () => ({ requireAdminSession: vi.fn().mockResolvedValue(undefined) }))

const { getRecipientSummaryAction, getTemplateForSelectionAction, previewCampaignAction } = await import('./email-actions')
const { prisma } = await import('@/lib/training/prisma')

// Self-contained and self-cleaning; hits the real database, mirroring the
// pattern used by the waitlist promotion action test — recipient resolution
// has no mockable boundary from Postgres.
const MARKER = 'email-actions-test'
const courseIds: string[] = []
const teacherIds: string[] = []
const registrationIds: string[] = []

async function makeCourse(name: string, overrides: Partial<{ reminderSubject: string | null; reminderMessage: string | null; zoomLink: string | null }> = {}) {
  const course = await prisma.course.create({
    data: {
      name: `${MARKER} ${name}`,
      slug: `${MARKER}-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      shortDescription: 'x',
      fullDescription: 'x',
      category: 'LEADERSHIP',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T10:00:00.000Z'),
      durationMinutes: 60,
      deliveryMethod: 'ONLINE',
      reminderSubject: overrides.reminderSubject ?? null,
      reminderMessage: overrides.reminderMessage ?? null,
      zoomLink: overrides.zoomLink ?? null,
    },
  })
  courseIds.push(course.id)
  return course
}

async function makeTeacher(index: number) {
  const email = `${MARKER}-${index}@test.local`
  const teacher = await prisma.teacher.create({
    data: {
      emailNormalised: email,
      emailOriginal: email,
      fullName: `${MARKER} Teacher ${index}`,
      phone: `+2010001${index}`,
      phoneNormalised: `+2010001${index}`,
      schoolNameOriginal: `${MARKER} School`,
      subjectOriginal: 'Mathematics',
      subjectNormalised: 'mathematics',
      gradeOriginal: 'Grade 3',
      gradeNormalised: 'grade 3',
      firstRegisteredAt: new Date(),
      lastRegisteredAt: new Date(),
    },
  })
  teacherIds.push(teacher.id)
  return teacher
}

async function makeRegistration(teacherId: string, courseId: string, status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' = 'CONFIRMED') {
  const registration = await prisma.registration.create({
    data: {
      reference: `${MARKER}-${teacherId}-${courseId}`,
      teacherId,
      courseId,
      courseNameSnapshot: 'x',
      courseDateSnapshot: new Date('2026-09-01T00:00:00.000Z'),
      courseFeeSnapshot: 0,
      courseCurrencySnapshot: 'EGP',
      status,
      emailType: status === 'WAITLISTED' ? 'WAITLISTED' : 'CONFIRMED',
    },
  })
  registrationIds.push(registration.id)
  return registration
}

afterAll(async () => {
  await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
  await prisma.$disconnect()
})

describe('getRecipientSummaryAction', () => {
  it('reports the de-duplicated count and never leaks an email address', async () => {
    const course = await makeCourse('summary')
    const teacher = await makeTeacher(1)
    const registration = await makeRegistration(teacher.id, course.id)

    const result = await getRecipientSummaryAction({ mode: 'ids', registrationIds: [registration.id] })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.uniqueTeacherCount).toBe(1)
    expect(result.data.rawRegistrationCount).toBe(1)
    expect(JSON.stringify(result.data)).not.toContain('@test.local')
  })

  it('returns the single course\'s Zoom link only when the selection resolves to exactly one course', async () => {
    const courseWithLink = await makeCourse('zoom-present', { zoomLink: 'https://zoom.us/j/999' })
    const teacher = await makeTeacher(2)
    const registration = await makeRegistration(teacher.id, courseWithLink.id)

    const result = await getRecipientSummaryAction({ mode: 'ids', registrationIds: [registration.id] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.singleCourseZoomLink).toBe('https://zoom.us/j/999')
  })

  it('reports no single-course Zoom link when the course has none stored', async () => {
    const course = await makeCourse('zoom-absent')
    const teacher = await makeTeacher(3)
    const registration = await makeRegistration(teacher.id, course.id)

    const result = await getRecipientSummaryAction({ mode: 'ids', registrationIds: [registration.id] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.singleCourseZoomLink).toBeNull()
  })
})

describe('getTemplateForSelectionAction', () => {
  it('overrides the Training Reminder default with the course\'s stored reminderSubject and reminderMessage', async () => {
    const course = await makeCourse('override', {
      reminderSubject: 'Course-specific subject',
      reminderMessage: 'Course-specific body',
    })
    const teacher = await makeTeacher(4)
    const registration = await makeRegistration(teacher.id, course.id)

    const result = await getTemplateForSelectionAction('REMINDER', { mode: 'ids', registrationIds: [registration.id] })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.overrideApplied).toBe(true)
    expect(result.data.subject).toBe('Course-specific subject')
    expect(result.data.body).toBe('Course-specific body')
  })

  it('falls back to the static default when the course has no stored override', async () => {
    const course = await makeCourse('no-override')
    const teacher = await makeTeacher(5)
    const registration = await makeRegistration(teacher.id, course.id)

    const result = await getTemplateForSelectionAction('REMINDER', { mode: 'ids', registrationIds: [registration.id] })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.overrideApplied).toBe(false)
    expect(result.data.subject).toContain('{{courseName}}')
  })

  it('does not apply the course override when the selection spans more than one course', async () => {
    const courseA = await makeCourse('multi-override-a', { reminderSubject: 'Should not be used' })
    const courseB = await makeCourse('multi-override-b')
    const teacherA = await makeTeacher(6)
    const teacherB = await makeTeacher(7)
    const regA = await makeRegistration(teacherA.id, courseA.id)
    const regB = await makeRegistration(teacherB.id, courseB.id)

    const result = await getTemplateForSelectionAction('REMINDER', { mode: 'ids', registrationIds: [regA.id, regB.id] })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.overrideApplied).toBe(false)
  })
})

describe('previewCampaignAction', () => {
  it('rejects a subject containing a line break', async () => {
    const course = await makeCourse('crlf')
    const teacher = await makeTeacher(8)
    const registration = await makeRegistration(teacher.id, course.id)

    const result = await previewCampaignAction(
      { mode: 'ids', registrationIds: [registration.id] },
      { subject: 'Line one\nLine two', body: 'Hello {{firstName}}' },
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.fieldErrors?.subject).toBeDefined()
  })

  it('resolves every token against a real recipient and leaves no literal token in the example', async () => {
    const course = await makeCourse('preview-tokens')
    const teacher = await makeTeacher(9)
    const registration = await makeRegistration(teacher.id, course.id)

    const result = await previewCampaignAction(
      { mode: 'ids', registrationIds: [registration.id] },
      { subject: 'Reminder: {{courseName}}', body: 'Hi {{firstName}}, see you at {{courseName}} on {{courseDate}}.' },
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.example.subject).not.toContain('{{')
    expect(result.data.example.html).not.toContain('{{')
    expect(result.data.example.subject).toContain(course.name)
  })

  it('warns with the correct count when the body uses {{zoomLink}} and the course has none stored', async () => {
    const course = await makeCourse('zoom-warning')
    const teacher = await makeTeacher(10)
    const registration = await makeRegistration(teacher.id, course.id)

    const result = await previewCampaignAction(
      { mode: 'ids', registrationIds: [registration.id] },
      { subject: 'Zoom link', body: 'Join: {{zoomLink}}' },
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.zoomLinkMissingCount).toBe(1)
  })
})
