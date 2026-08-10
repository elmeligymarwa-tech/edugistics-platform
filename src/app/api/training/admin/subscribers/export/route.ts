import { NextResponse, type NextRequest } from 'next/server'

import { parseSubscriberSearchParams } from '@/domain/training/subscriber-filters'
import { toCairoCalendarDate } from '@/domain/training/timezone'
import { isAdminAuthenticated } from '@/lib/training/auth/require-admin'
import { buildSubscribersWorkbook } from '@/lib/training/export/subscribers-workbook'

export async function GET(request: NextRequest) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: 'Admin session required.' }, { status: 401 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const filters = parseSubscriberSearchParams(params)

  const { workbook } = await buildSubscribersWorkbook(filters)
  const buffer = await workbook.xlsx.writeBuffer()

  const dateStamp = toCairoCalendarDate(new Date()).toISOString().slice(0, 10)
  const filename = `edugistics-subscribers-${dateStamp}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
