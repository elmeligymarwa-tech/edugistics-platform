import 'server-only'

import { formatAdminTimestamp, formatCourseDateLong } from '@/domain/training/format'
import { escapeHtml } from './email/html'
import type { AttendanceSheetData } from './attendance-sheet'

/**
 * A printable HTML page, not a PDF — the admin uses the browser's own print
 * dialog (Ctrl/Cmd+P), which is what makes @page sizing and the repeating
 * <thead> below work without a PDF-generation dependency. thead's
 * `display: table-header-group` is what repeats the column header row on
 * every printed page; `break-inside: avoid` on each row keeps a single
 * registration from being split across a page boundary.
 *
 * A4 landscape, not portrait: eight columns including a genuinely wide,
 * blank Signature column need more horizontal room than portrait's ~180mm
 * usable width gives — landscape's ~267mm is what keeps Mobile Number and
 * Reference code legible instead of crushed.
 */
export function buildAttendanceSheetHtml(data: AttendanceSheetData): string {
  const { course, rows, includeWaitlisted, session } = data
  const dateLabel = session
    ? `Session ${session.sessionNumber} of ${session.totalSessions} — ${formatCourseDateLong(session.sessionDate)}`
    : formatCourseDateLong(course.courseDate)

  const rowsHtml = rows
    .map((row) => {
      const waitlisted = row.status === 'WAITLISTED'
      return `
      <tr class="${waitlisted ? 'waitlisted' : ''}">
        <td>${escapeHtml(row.teacherFullName)}${waitlisted ? ' <span class="tag">Waitlisted — not confirmed</span>' : ''}</td>
        <td>${escapeHtml(row.mobileNumber)}</td>
        <td>${escapeHtml(row.courseName)}</td>
        <td>${escapeHtml(formatAdminTimestamp(row.registeredAt))}</td>
        <td class="mono">${escapeHtml(row.reference)}</td>
        <td class="box"></td>
        <td class="box"></td>
        <td class="signature"></td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Attendance sheet — ${escapeHtml(course.name)}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        color: #17213d;
        margin: 0;
        padding: 16px;
      }
      h1 { font-size: 18px; margin: 0 0 4px 0; }
      .meta { font-size: 13px; color: #4c5570; margin: 0 0 2px 0; }
      .meta.note { color: #8a5a00; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
      thead { display: table-header-group; }
      th, td { border: 1px solid #c7ccd9; padding: 6px 8px; text-align: left; vertical-align: middle; overflow-wrap: break-word; }
      th { background: #eef1f7; font-weight: 600; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      td.mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
      td.box { width: 6%; text-align: center; }
      td.box::after {
        content: '';
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 1px solid #17213d;
      }
      td.signature { width: 20%; }
      tr.waitlisted td { background: #fff8ec; }
      .tag { font-size: 10px; font-weight: 600; color: #8a5a00; }
      .print-hint { margin-top: 16px; font-size: 12px; color: #4c5570; }
      @media print {
        .print-hint { display: none; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(course.name)}</h1>
    <p class="meta">${escapeHtml(dateLabel)}</p>
    <p class="meta">${rows.length} registration${rows.length === 1 ? '' : 's'} listed${includeWaitlisted ? ' (confirmed and waitlisted)' : ' (confirmed only)'}</p>
    ${includeWaitlisted ? '<p class="meta note">Rows marked "Waitlisted — not confirmed" did not hold a confirmed place.</p>' : ''}

    <table>
      <colgroup>
        <col style="width: 18%" />
        <col style="width: 12%" />
        <col style="width: 16%" />
        <col style="width: 12%" />
        <col style="width: 10%" />
        <col style="width: 6%" />
        <col style="width: 6%" />
        <col style="width: 20%" />
      </colgroup>
      <thead>
        <tr>
          <th>Attendee Name</th>
          <th>Mobile Number</th>
          <th>Course registered</th>
          <th>Registration date</th>
          <th>Reference code</th>
          <th>SHOW</th>
          <th>NO SHOW</th>
          <th>Signature</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="8">No registrations to list.</td></tr>'}
      </tbody>
    </table>

    <p class="print-hint">Use your browser's Print (Ctrl/Cmd+P) to print or save as PDF — this page is formatted for A4 landscape.</p>
  </body>
</html>`
}
