import 'server-only'

import type ExcelJS from 'exceljs'

export const NAVY_ARGB = 'FF2B3A67'
export const WHITE_ARGB = 'FFFFFFFF'
export const DATE_FORMAT = 'dd/mm/yyyy'

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

/** Bold navy header, frozen header row, autofilter, fitted column widths — every exported sheet in this application looks the same. */
export function finishSheet(sheet: ExcelJS.Worksheet) {
  styleHeaderRow(sheet)
  freezeAndFilter(sheet)
  autoFitColumns(sheet)
}
