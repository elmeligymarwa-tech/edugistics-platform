import { NextResponse, type NextRequest } from 'next/server'

import { isAdminAuthenticated } from '@/lib/training/auth/require-admin'
import { writeAuditLog } from '@/lib/training/audit-log'
import { buildAttendanceSheetHtml } from '@/lib/training/attendance-sheet-html'
import {
  CourseNotFoundError,
  SessionNotFoundError,
  SessionRequiredError,
  listRegistrationsForAttendanceSheet,
} from '@/lib/training/attendance-sheet'

export async function GET(request: NextRequest) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: 'Admin session required.' }, { status: 401 })
  }

  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) {
    return NextResponse.json({ error: 'A course must be selected to print an attendance sheet.' }, { status: 400 })
  }

  const includeWaitlisted = request.nextUrl.searchParams.get('includeWaitlisted') === 'true'
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  let data
  try {
    data = await listRegistrationsForAttendanceSheet(courseId, includeWaitlisted, sessionId)
  } catch (error) {
    if (error instanceof CourseNotFoundError || error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
    }
    if (error instanceof SessionRequiredError) {
      return NextResponse.json({ error: 'Select a session date to print an attendance sheet for.' }, { status: 400 })
    }
    throw error
  }

  await writeAuditLog({
    action: 'ATTENDANCE_SHEET_PRINTED',
    entityType: 'Course',
    entityId: courseId,
    afterJson: { includeWaitlisted, registrationCount: data.rows.length },
  })

  const html = buildAttendanceSheetHtml(data)

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
