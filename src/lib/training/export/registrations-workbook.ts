import 'server-only'

import ExcelJS from 'exceljs'

import { EMAIL_STATUS_LABELS, STATUS_LABELS } from '@/components/training/admin/registration-badges'
import { COURSE_CATEGORY_LABELS } from '@/domain/training/schema'
import { toCairoCalendarDate } from '@/domain/training/timezone'
import { listAllRegistrationsForExport, type ExportRegistrationRow, type RegistrationFilters } from '@/lib/training/registrations'

const NAVY_ARGB = 'FF2B3A67'
const WHITE_ARGB = 'FFFFFFFF'
const DATE_FORMAT = 'dd/mm/yyyy'

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1)
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE_ARGB } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ARGB } }
  })
}

function freezeAndFilter(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  const lastColumn = sheet.columns.length
  const lastColumnLetter = sheet.getColumn(lastColumn).letter
  sheet.autoFilter = `A1:${lastColumnLetter}1`
}

/** Column widths sized to their longest cell, since exceljs never fits columns on its own. */
function autoFitColumns(sheet: ExcelJS.Worksheet) {
  for (const column of sheet.columns) {
    let maxLength = typeof column.header === 'string' ? column.header.length : 10
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = cell.value instanceof Date ? DATE_FORMAT.length : String(cell.value ?? '').length
      maxLength = Math.max(maxLength, length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 10), 50)
  }
}

function finishSheet(sheet: ExcelJS.Worksheet) {
  styleHeaderRow(sheet)
  freezeAndFilter(sheet)
  autoFitColumns(sheet)
}

function buildRegistrationsSheet(workbook: ExcelJS.Workbook, registrations: ExportRegistrationRow[]) {
  const sheet = workbook.addWorksheet('Registrations')
  sheet.columns = [
    { header: 'Registration Date', key: 'registrationDate', width: 16 },
    { header: 'Reference', key: 'reference', width: 16 },
    { header: 'Course', key: 'course', width: 32 },
    { header: 'Course Date', key: 'courseDate', width: 14 },
    { header: 'Course Fee', key: 'courseFee', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Waitlist Position', key: 'waitlistPosition', width: 16 },
    { header: 'Full Name', key: 'fullName', width: 22 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'School', key: 'school', width: 26 },
    { header: 'Subject', key: 'subject', width: 18 },
    { header: 'Grade', key: 'grade', width: 14 },
    { header: 'Marketing Consent', key: 'marketingConsent', width: 16 },
    { header: 'Email Status', key: 'emailStatus', width: 14 },
  ]

  for (const registration of registrations) {
    const row = sheet.addRow({
      registrationDate: toCairoCalendarDate(registration.registeredAt),
      reference: registration.reference,
      course: registration.courseNameSnapshot,
      courseDate: registration.courseDateSnapshot,
      courseFee: Number(registration.courseFeeSnapshot),
      status: STATUS_LABELS[registration.status],
      waitlistPosition: registration.waitlistPosition ?? '',
      fullName: registration.teacher.fullName,
      email: registration.teacher.emailOriginal,
      phone: registration.teacher.phone,
      address: registration.teacher.address ?? '',
      school: registration.teacher.schoolNameOriginal,
      subject: registration.teacher.subjectOriginal,
      grade: registration.teacher.gradeOriginal,
      marketingConsent: registration.teacher.marketingConsent ? 'Yes' : 'No',
      emailStatus: EMAIL_STATUS_LABELS[registration.emailStatus],
    })
    row.getCell('registrationDate').numFmt = DATE_FORMAT
    row.getCell('courseDate').numFmt = DATE_FORMAT
    row.getCell('courseFee').numFmt = `"${registration.courseCurrencySnapshot} "#,##0.00`
  }

  finishSheet(sheet)
}

function buildTeachersSheet(workbook: ExcelJS.Workbook, registrations: ExportRegistrationRow[]) {
  const sheet = workbook.addWorksheet('Teachers')
  sheet.columns = [
    { header: 'Full Name', key: 'fullName', width: 22 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'School', key: 'school', width: 26 },
    { header: 'Subject', key: 'subject', width: 18 },
    { header: 'Grade', key: 'grade', width: 14 },
    { header: 'Total Confirmed Courses', key: 'totalConfirmed', width: 20 },
    { header: 'First Registration', key: 'firstRegistration', width: 16 },
    { header: 'Last Registration', key: 'lastRegistration', width: 16 },
    { header: 'Marketing Consent', key: 'marketingConsent', width: 16 },
  ]

  interface TeacherAgg {
    teacher: ExportRegistrationRow['teacher']
    confirmed: number
    first: Date
    last: Date
  }
  const byTeacher = new Map<string, TeacherAgg>()

  for (const registration of registrations) {
    const teacher = registration.teacher
    const entry = byTeacher.get(teacher.id)
    if (!entry) {
      byTeacher.set(teacher.id, {
        teacher,
        confirmed: registration.status === 'CONFIRMED' ? 1 : 0,
        first: registration.registeredAt,
        last: registration.registeredAt,
      })
    } else {
      if (registration.status === 'CONFIRMED') entry.confirmed += 1
      if (registration.registeredAt < entry.first) entry.first = registration.registeredAt
      if (registration.registeredAt > entry.last) entry.last = registration.registeredAt
    }
  }

  for (const { teacher, confirmed, first, last } of byTeacher.values()) {
    const row = sheet.addRow({
      fullName: teacher.fullName,
      email: teacher.emailOriginal,
      phone: teacher.phone,
      address: teacher.address ?? '',
      school: teacher.schoolNameOriginal,
      subject: teacher.subjectOriginal,
      grade: teacher.gradeOriginal,
      totalConfirmed: confirmed,
      firstRegistration: toCairoCalendarDate(first),
      lastRegistration: toCairoCalendarDate(last),
      marketingConsent: teacher.marketingConsent ? 'Yes' : 'No',
    })
    row.getCell('firstRegistration').numFmt = DATE_FORMAT
    row.getCell('lastRegistration').numFmt = DATE_FORMAT
  }

  finishSheet(sheet)
}

function buildSchoolsSheet(workbook: ExcelJS.Workbook, registrations: ExportRegistrationRow[]) {
  const sheet = workbook.addWorksheet('Schools')
  sheet.columns = [
    { header: 'School Name', key: 'schoolName', width: 28 },
    { header: 'Unique Teachers', key: 'uniqueTeachers', width: 16 },
    { header: 'Total Registrations', key: 'totalRegistrations', width: 18 },
    { header: 'Courses Attended', key: 'coursesAttended', width: 18 },
    { header: 'First Registration', key: 'firstRegistration', width: 16 },
    { header: 'Last Registration', key: 'lastRegistration', width: 16 },
  ]

  interface SchoolAgg {
    name: string
    teacherIds: Set<string>
    courseIds: Set<string>
    total: number
    first: Date
    last: Date
  }
  const bySchool = new Map<string, SchoolAgg>()

  for (const registration of registrations) {
    const teacher = registration.teacher
    const key = teacher.schoolId ?? `unresolved:${teacher.schoolNameOriginal}`
    const name = teacher.school?.canonicalName ?? teacher.schoolNameOriginal

    let entry = bySchool.get(key)
    if (!entry) {
      entry = { name, teacherIds: new Set(), courseIds: new Set(), total: 0, first: registration.registeredAt, last: registration.registeredAt }
      bySchool.set(key, entry)
    }
    entry.teacherIds.add(teacher.id)
    entry.courseIds.add(registration.courseId)
    entry.total += 1
    if (registration.registeredAt < entry.first) entry.first = registration.registeredAt
    if (registration.registeredAt > entry.last) entry.last = registration.registeredAt
  }

  for (const entry of bySchool.values()) {
    const row = sheet.addRow({
      schoolName: entry.name,
      uniqueTeachers: entry.teacherIds.size,
      totalRegistrations: entry.total,
      coursesAttended: entry.courseIds.size,
      firstRegistration: toCairoCalendarDate(entry.first),
      lastRegistration: toCairoCalendarDate(entry.last),
    })
    row.getCell('firstRegistration').numFmt = DATE_FORMAT
    row.getCell('lastRegistration').numFmt = DATE_FORMAT
  }

  finishSheet(sheet)
}

function buildCoursePerformanceSheet(workbook: ExcelJS.Workbook, registrations: ExportRegistrationRow[]) {
  const sheet = workbook.addWorksheet('Course Performance')
  sheet.columns = [
    { header: 'Course Name', key: 'courseName', width: 32 },
    { header: 'Course Date', key: 'courseDate', width: 14 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Fee', key: 'fee', width: 14 },
    { header: 'Confirmed Registrations', key: 'confirmed', width: 20 },
    { header: 'Waitlisted', key: 'waitlisted', width: 14 },
    { header: 'Capacity', key: 'capacity', width: 12 },
    { header: 'Remaining Seats', key: 'remainingSeats', width: 16 },
    { header: 'Utilisation %', key: 'utilisation', width: 14 },
    { header: 'Unique Teachers', key: 'uniqueTeachers', width: 16 },
    { header: 'Unique Schools', key: 'uniqueSchools', width: 16 },
  ]

  interface CourseAgg {
    course: ExportRegistrationRow['course']
    confirmed: number
    waitlisted: number
    teacherIds: Set<string>
    schoolIds: Set<string>
  }
  const byCourse = new Map<string, CourseAgg>()

  for (const registration of registrations) {
    let entry = byCourse.get(registration.courseId)
    if (!entry) {
      entry = { course: registration.course, confirmed: 0, waitlisted: 0, teacherIds: new Set(), schoolIds: new Set() }
      byCourse.set(registration.courseId, entry)
    }
    if (registration.status === 'CONFIRMED') {
      entry.confirmed += 1
      entry.teacherIds.add(registration.teacherId)
      if (registration.teacher.schoolId) entry.schoolIds.add(registration.teacher.schoolId)
    }
    if (registration.status === 'WAITLISTED') entry.waitlisted += 1
  }

  for (const entry of byCourse.values()) {
    const { course } = entry
    const remainingSeats = course.maxCapacity == null ? null : course.maxCapacity - entry.confirmed
    const utilisation = course.maxCapacity == null ? null : (entry.confirmed / course.maxCapacity) * 100

    const row = sheet.addRow({
      courseName: course.name,
      courseDate: course.courseDate,
      category: COURSE_CATEGORY_LABELS[course.category],
      fee: Number(course.feeAmount),
      confirmed: entry.confirmed,
      waitlisted: entry.waitlisted,
      capacity: course.maxCapacity ?? 'Unlimited',
      remainingSeats: remainingSeats ?? 'Unlimited',
      utilisation: utilisation == null ? '' : Math.round(utilisation * 10) / 10,
      uniqueTeachers: entry.teacherIds.size,
      uniqueSchools: entry.schoolIds.size,
    })
    row.getCell('courseDate').numFmt = DATE_FORMAT
    row.getCell('fee').numFmt = `"${course.currency} "#,##0.00`
    if (utilisation != null) row.getCell('utilisation').numFmt = '0.0"%"'
  }

  finishSheet(sheet)
}

export async function buildRegistrationsWorkbook(filters: RegistrationFilters): Promise<{ workbook: ExcelJS.Workbook; rowCount: number }> {
  const registrations = await listAllRegistrationsForExport(filters)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Edugistics'
  workbook.created = new Date()

  buildRegistrationsSheet(workbook, registrations)
  buildTeachersSheet(workbook, registrations)
  buildSchoolsSheet(workbook, registrations)
  buildCoursePerformanceSheet(workbook, registrations)

  return { workbook, rowCount: registrations.length }
}
