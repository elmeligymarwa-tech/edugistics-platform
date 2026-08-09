'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CAMPAIGN_PAGE_SIZE } from '@/domain/training/campaign-filters'
import { formatAdminTimestamp } from '@/domain/training/format'
import { CAMPAIGN_EMAIL_TYPE_LABELS } from '@/domain/training/schema'
import type { CampaignListItem } from '@/lib/training/email/campaign-analytics'

const columnHelper = createColumnHelper<CampaignListItem>()

function formatSuccessRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate)}%`
}

const campaignColumns = [
  columnHelper.accessor('createdAt', {
    header: 'Date',
    cell: (info) => formatAdminTimestamp(info.getValue()),
  }),
  columnHelper.accessor('courseName', {
    header: 'Course',
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground italic">Multiple courses</span>,
  }),
  columnHelper.accessor('subject', {
    header: 'Subject',
    cell: (info) => (
      <Link href={`/training/admin/emails/${info.row.original.id}`} className="text-foreground underline-offset-2 hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('emailType', {
    header: 'Type',
    cell: (info) => CAMPAIGN_EMAIL_TYPE_LABELS[info.getValue()],
  }),
  columnHelper.accessor('recipientCount', { header: 'Recipients' }),
  columnHelper.accessor('sentCount', {
    header: 'Sent',
    cell: (info) => <span className="text-success">{info.getValue()}</span>,
  }),
  columnHelper.accessor('failedCount', {
    header: 'Failed',
    // The at-a-glance failure signal the spec asks for — a destructive badge whenever a campaign has any failures, not just a plain number.
    cell: (info) => (info.getValue() > 0 ? <Badge variant="destructive">{info.getValue()} failed</Badge> : <span>0</span>),
  }),
  columnHelper.accessor('successRate', {
    header: 'Success rate',
    cell: (info) => formatSuccessRate(info.getValue()),
  }),
]

export function CampaignsTable({ rows, totalCount, page }: { rows: CampaignListItem[]; totalCount: number; page: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const table = useReactTable({ data: rows, columns: campaignColumns, getCoreRowModel: getCoreRowModel() })
  const headerGroups = useMemo(() => table.getHeaderGroups(), [table])

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage + 1))
    router.push(`${pathname}?${params.toString()}`)
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No campaigns match these filters.</p>
  }

  const rangeStart = totalCount === 0 ? 0 : page * CAMPAIGN_PAGE_SIZE + 1
  const rangeEnd = Math.min(totalCount, (page + 1) * CAMPAIGN_PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <Table className="data-table">
        <TableHeader>
          {headerGroups.map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {rangeStart}–{rangeEnd} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 0}>
            <ChevronLeft /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={rangeEnd >= totalCount}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
