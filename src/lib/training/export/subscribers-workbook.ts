import 'server-only'

import ExcelJS from 'exceljs'

import { SUBSCRIBER_STATUS_LABELS } from '@/components/training/admin/subscriber-status-badge'
import { toCairoCalendarDate } from '@/domain/training/timezone'
import type { SubscriberFilters } from '@/domain/training/subscriber-filters'
import { listAllSubscribersForExport } from '@/lib/training/subscribers-admin'
import { DATE_FORMAT, finishSheet } from './workbook-style'

const CONSENT_SOURCE_LABELS: Record<string, string> = {
  TRAINING_REGISTRATION: 'Training registration',
  ADMIN_MANUAL: 'Admin (manual)',
  MIGRATED: 'Migrated',
}

/** Formatting matches every other export in this application: bold navy header, frozen header row, autofilter, real date cells, fitted column widths. */
export async function buildSubscribersWorkbook(filters: SubscriberFilters): Promise<{ workbook: ExcelJS.Workbook; rowCount: number }> {
  const subscribers = await listAllSubscribersForExport(filters)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Edugistics'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Subscribers')
  sheet.columns = [
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'School', key: 'school', width: 26 },
    { header: 'Subject', key: 'subject', width: 18 },
    { header: 'Grade', key: 'grade', width: 14 },
    { header: 'Subscription Status', key: 'status', width: 16 },
    { header: 'Subscription Date', key: 'subscriptionDate', width: 16 },
    { header: 'Subscription Source', key: 'source', width: 18 },
    { header: 'Course Subscribed From', key: 'course', width: 28 },
    { header: 'Last Marketing Email', key: 'lastMarketingEmail', width: 18 },
    { header: 'Marketing Emails Sent', key: 'emailsSent', width: 18 },
  ]

  for (const subscriber of subscribers) {
    // A landing page subscriber has no linked teacher — school/subject/grade/phone
    // render blank rather than breaking; name/email fall back to the subscriber's
    // own stored values.
    const row = sheet.addRow({
      name: subscriber.teacher?.fullName ?? subscriber.fullName ?? '',
      email: subscriber.teacher?.emailOriginal ?? subscriber.emailOriginal ?? subscriber.emailNormalised,
      phone: subscriber.teacher?.phone ?? '',
      school: subscriber.teacher?.schoolNameOriginal ?? '',
      subject: subscriber.teacher?.subjectOriginal ?? '',
      grade: subscriber.teacher?.gradeOriginal ?? '',
      status: SUBSCRIBER_STATUS_LABELS[subscriber.status],
      subscriptionDate: toCairoCalendarDate(subscriber.subscribedAt),
      source: CONSENT_SOURCE_LABELS[subscriber.consentSource] ?? subscriber.consentSource,
      course: subscriber.consentCourse?.name ?? '',
      lastMarketingEmail: subscriber.lastMarketingEmailAt ? toCairoCalendarDate(subscriber.lastMarketingEmailAt) : '',
      emailsSent: subscriber.marketingEmailsSent,
    })
    row.getCell('subscriptionDate').numFmt = DATE_FORMAT
    if (subscriber.lastMarketingEmailAt) row.getCell('lastMarketingEmail').numFmt = DATE_FORMAT
  }

  finishSheet(sheet)

  return { workbook, rowCount: subscribers.length }
}
