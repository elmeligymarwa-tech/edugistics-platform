import { describe, expect, it } from 'vitest'

import { buildAttendanceSheetHtml } from './attendance-sheet-html'
import type { AttendanceSheetData } from './attendance-sheet'

function makeData(overrides: Partial<AttendanceSheetData> = {}): AttendanceSheetData {
  return {
    course: {
      id: 'course-1',
      name: 'Classroom Management',
      courseDate: new Date('2026-09-01T00:00:00.000Z'),
      isMultiDay: false,
      sessions: [],
    },
    rows: [],
    includeWaitlisted: false,
    session: null,
    ...overrides,
  }
}

describe('buildAttendanceSheetHtml — Attendee Name column', () => {
  it('shows the complete stored name, not just the first word, for a two-part name', () => {
    const html = buildAttendanceSheetHtml(
      makeData({
        rows: [
          {
            registrationId: 'reg-1',
            teacherFullName: 'Amina Hassan',
            mobileNumber: '+201000000',
            courseName: 'Classroom Management',
            registeredAt: new Date('2026-08-01T10:00:00.000Z'),
            reference: 'REF-1',
            status: 'CONFIRMED',
          },
        ],
      }),
    )

    expect(html).toContain('Amina Hassan')
    expect(html).not.toContain('<td>Amina</td>')
  })

  it('displays a single-word name as-is', () => {
    const html = buildAttendanceSheetHtml(
      makeData({
        rows: [
          {
            registrationId: 'reg-2',
            teacherFullName: 'Cher',
            mobileNumber: '+201000001',
            courseName: 'Classroom Management',
            registeredAt: new Date('2026-08-01T10:00:00.000Z'),
            reference: 'REF-2',
            status: 'CONFIRMED',
          },
        ],
      }),
    )

    expect(html).toContain('Cher')
  })
})
