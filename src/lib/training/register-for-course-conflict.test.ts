// Unit tests for the two pure helpers behind defect 6's fix: recognising a
// P2002 on Registration's @@unique([courseId, teacherId]) constraint, and
// the consistent "already registered" message built from the row it
// collided with. Both are pure — no Prisma client, no database — safe to
// run via `npm run test:registration-conflict`
// (vitest.registration-conflict.config.mts), which has no globalSetup.
import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { alreadyRegisteredMessage, isUniqueConstraintOnCourseTeacher } from './register-for-course'

function p2002(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: { target },
  })
}

describe('isUniqueConstraintOnCourseTeacher', () => {
  it('recognises the courseId/teacherId unique constraint', () => {
    expect(isUniqueConstraintOnCourseTeacher(p2002(['courseId', 'teacherId']))).toBe(true)
  })

  it('does not match a different unique constraint (e.g. the reference field)', () => {
    expect(isUniqueConstraintOnCourseTeacher(p2002(['reference']))).toBe(false)
  })

  it('does not match a P2002 missing target metadata', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.0.0' })
    expect(isUniqueConstraintOnCourseTeacher(error)).toBe(false)
  })

  it('does not match a non-P2002 Prisma error', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '6.0.0' })
    expect(isUniqueConstraintOnCourseTeacher(error)).toBe(false)
  })

  it('does not match a plain Error, or a non-error value', () => {
    expect(isUniqueConstraintOnCourseTeacher(new Error('boom'))).toBe(false)
    expect(isUniqueConstraintOnCourseTeacher('boom')).toBe(false)
    expect(isUniqueConstraintOnCourseTeacher(null)).toBe(false)
    expect(isUniqueConstraintOnCourseTeacher(undefined)).toBe(false)
  })
})

describe('alreadyRegisteredMessage', () => {
  it('says "registered" and names the reference for a CONFIRMED row', () => {
    const message = alreadyRegisteredMessage({ status: 'CONFIRMED', reference: 'EDU-2026-ABC123' })
    expect(message).toContain('already registered for this course')
    expect(message).toContain('EDU-2026-ABC123')
  })

  it('says "waiting list", not "registered", for a WAITLISTED row', () => {
    const message = alreadyRegisteredMessage({ status: 'WAITLISTED', reference: 'EDU-2026-XYZ789' })
    expect(message).toContain('already on the waiting list for this course')
    expect(message).not.toContain('already registered for this course')
    expect(message).toContain('EDU-2026-XYZ789')
  })
})
