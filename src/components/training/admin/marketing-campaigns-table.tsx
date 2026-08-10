'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MARKETING_CAMPAIGN_PAGE_SIZE } from '@/domain/training/marketing-campaign-filters'
import { formatAdminTimestamp } from '@/domain/training/format'
import type { MarketingCampaignListItem } from '@/lib/training/email/marketing-campaign-analytics'

const columnHelper = createColumnHelper<MarketingCampaignListItem>()

function formatSuccessRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate)}%`
}

const campaignColumns = [
  columnHelper.accessor('createdAt', {
    header: 'Date (Cairo time)',
    cell: (info) => formatAdminTimestamp(info.getValue()),
  }),
  columnHelper.accessor('subject', {
    header: 'Subject',
    cell: (info) => (
      <Link href={`/training/admin/subscribers/campaigns/${info.row.original.id}`} className="text-foreground underline-offset-2 hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('recipientCount', { header: 'Recipients' }),
  columnHelper.accessor('sentCount', {
    header: 'Sent',
    cell: (info) => <span className="text-success">{info.getValue()}</span>,
  }),
  columnHelper.accessor('failedCount', {
    header: 'Failed',
    // Failures visible at a glance, not only inside the detail view — a destructive badge whenever a campaign has any failures.
    cell: (info) => (info.getValue() > 0 ? <Badge variant="destructive">{info.getValue()} failed</Badge> : <span>0</span>),
  }),
  columnHelper.accessor('skippedCount', {
    header: 'Skipped',
    cell: (info) => (info.getValue() > 0 ? <Badge variant="warning">{info.getValue()} skipped</Badge> : <span>0</span>),
  }),
  columnHelper.accessor('successRate', {
    header: 'Success rate',
    cell: (info) => formatSuccessRate(info.getValue()),
  }),
]

export function MarketingCampaignsTable({ rows, totalCount, page }: { rows: MarketingCampaignListItem[]; totalCount: number; page: number }) {
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

  const rangeStart = totalCount === 0 ? 0 : page * MARKETING_CAMPAIGN_PAGE_SIZE + 1
  const rangeEnd = Math.min(totalCount, (page + 1) * MARKETING_CAMPAIGN_PAGE_SIZE)

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
