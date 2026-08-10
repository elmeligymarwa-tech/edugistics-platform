import 'server-only'

import ExcelJS from 'exceljs'

import { EMAIL_STATUS_LABELS, STATUS_LABELS } from '@/components/training/admin/registration-badges'
import { PROMO_CODE_DISCOUNT_TYPE_LABELS, PROMO_CODE_STATUS_LABELS } from '@/domain/training/promo-code'
import { COURSE_CATEGORY_LABELS } from '@/domain/training/schema'
import { toCairoCalendarDate } from '@/domain/training/timezone'
import { listAllRegistrationsForExport, type ExportRegistrationRow, type RegistrationFilters } from '@/lib/training/registrations'
import { listAllPromoCodesForExport, type PromoCodeListItem } from '@/lib/training/promo-codes'

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
    { header: 'Original Fee', key: 'originalFee', width: 14 },
    { header: 'Promo Code', key: 'promoCode', width: 16 },
    { header: 'Discount Type', key: 'discountType', width: 14 },
    { header: 'Discount Value', key: 'discountValue', width: 14 },
    { header: 'Discount Amount', key: 'discountAmount', width: 16 },
    { header: 'Final Fee', key: 'finalFee', width: 14 },
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
    // A blank promo cell clearly means "no code was used" — never a coerced
    // zero, which would be indistinguishable from a code that discounted
    // nothing.
    const hasPromo = registration.promoCodeSnapshot != null
    const row = sheet.addRow({
      registrationDate: toCairoCalendarDate(registration.registeredAt),
      reference: registration.reference,
      course: registration.courseNameSnapshot,
      courseDate: registration.courseDateSnapshot,
      courseFee: Number(registration.courseFeeSnapshot),
      originalFee: hasPromo ? Number(registration.originalFee) : '',
      promoCode: registration.promoCodeSnapshot ?? '',
      discountType: registration.discountTypeSnapshot ? PROMO_CODE_DISCOUNT_TYPE_LABELS[registration.discountTypeSnapshot] : '',
      discountValue: hasPromo ? Number(registration.discountValueSnapshot) : '',
      discountAmount: hasPromo ? Number(registration.discountAmount) : '',
      finalFee: hasPromo ? Number(registration.finalFee) : '',
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
    if (hasPromo) {
      row.getCell('originalFee').numFmt = `"${registration.courseCurrencySnapshot} "#,##0.00`
      row.getCell('discountAmount').numFmt = `"${registration.courseCurrencySnapshot} "#,##0.00`
      row.getCell('finalFee').numFmt = `"${registration.courseCurrencySnapshot} "#,##0.00`
    }
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

/**
 * Every figure comes from listAllPromoCodesForExport — the same
 * getPromoCodeUsageAggregates aggregation the admin list and dashboard use,
 * never recalculated here. "Uses"/"Remaining"/"Total discount given" count
 * CONFIRMED registrations only, per summarisePromoCodeUsage.
 */
function buildPromoCodesSheet(workbook: ExcelJS.Workbook, promoCodes: PromoCodeListItem[]) {
  const sheet = workbook.addWorksheet('Promo Codes')
  sheet.columns = [
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Description', key: 'description', width: 32 },
    { header: 'Discount Type', key: 'discountType', width: 14 },
    { header: 'Discount Value', key: 'discountValue', width: 14 },
    { header: 'Applies To', key: 'appliesTo', width: 22 },
    { header: 'Start Date', key: 'startDate', width: 14 },
    { header: 'Expiry Date', key: 'expiryDate', width: 14 },
    { header: 'Maximum Total Uses', key: 'maxTotalUses', width: 18 },
    { header: 'Maximum Uses Per Teacher', key: 'maxUsesPerTeacher', width: 20 },
    { header: 'Uses', key: 'uses', width: 10 },
    { header: 'Remaining', key: 'remaining', width: 12 },
    { header: 'Total Discount Given', key: 'totalDiscountGiven', width: 18 },
    { header: 'Potential Registration Value', key: 'potentialRegistrationValue', width: 22 },
    { header: 'Status', key: 'status', width: 12 },
  ]

  for (const promoCode of promoCodes) {
    const row = sheet.addRow({
      code: promoCode.code,
      description: promoCode.description,
      discountType: PROMO_CODE_DISCOUNT_TYPE_LABELS[promoCode.discountType],
      discountValue: promoCode.discountValue,
      appliesTo: promoCode.appliesToLabel,
      startDate: promoCode.startsAt ? toCairoCalendarDate(promoCode.startsAt) : '',
      expiryDate: promoCode.expiresAt ? toCairoCalendarDate(promoCode.expiresAt) : '',
      maxTotalUses: promoCode.maxTotalUses ?? 'Unlimited',
      maxUsesPerTeacher: promoCode.maxUsesPerTeacher,
      uses: promoCode.useCount,
      remaining: promoCode.remainingUses ?? 'Unlimited',
      totalDiscountGiven: promoCode.totalDiscountGiven,
      potentialRegistrationValue: promoCode.potentialRegistrationValue,
      status: PROMO_CODE_STATUS_LABELS[promoCode.status],
    })
    if (promoCode.startsAt) row.getCell('startDate').numFmt = DATE_FORMAT
    if (promoCode.expiresAt) row.getCell('expiryDate').numFmt = DATE_FORMAT
    row.getCell('totalDiscountGiven').numFmt = `"${promoCode.currency} "#,##0.00`
    row.getCell('potentialRegistrationValue').numFmt = `"${promoCode.currency} "#,##0.00`
  }

  finishSheet(sheet)
}

export async function buildRegistrationsWorkbook(filters: RegistrationFilters): Promise<{ workbook: ExcelJS.Workbook; rowCount: number }> {
  const registrations = await listAllRegistrationsForExport(filters)
  const promoCodes = await listAllPromoCodesForExport()

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Edugistics'
  workbook.created = new Date()

  buildRegistrationsSheet(workbook, registrations)
  buildTeachersSheet(workbook, registrations)
  buildSchoolsSheet(workbook, registrations)
  buildCoursePerformanceSheet(workbook, registrations)
  buildPromoCodesSheet(workbook, promoCodes)

  return { workbook, rowCount: registrations.length }
}
