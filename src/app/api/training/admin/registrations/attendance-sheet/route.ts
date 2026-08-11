import { NextResponse, type NextRequest } from 'next/server'

import { isAdminAuthenticated } from '@/lib/training/auth/require-admin'
import { writeAuditLog } from '@/lib/training/audit-log'
import { buildAttendanceSheetHtml } from '@/lib/training/attendance-sheet-html'
import { CourseNotFoundError, listRegistrationsForAttendanceSheet } from '@/lib/training/attendance-sheet'

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

  let data
  try {
    data = await listRegistrationsForAttendanceSheet(courseId, includeWaitlisted)
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
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
