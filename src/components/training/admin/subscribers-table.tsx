'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAdminTimestamp } from '@/domain/training/format'
import { SUBSCRIBERS_PAGE_SIZE } from '@/domain/training/subscriber-filters'
import type { SubscriberListItem } from '@/lib/training/subscribers-admin'
import { SubscriberStatusBadge } from './subscriber-status-badge'
import { useSubscribersSelection } from './subscribers-selection-context'

const CONSENT_SOURCE_LABELS: Record<string, string> = {
  TRAINING_REGISTRATION: 'Training registration',
  ADMIN_MANUAL: 'Admin (manual)',
  MIGRATED: 'Migrated',
}

/** Unsubscribed contacts can never be selected, regardless of the active filter. */
function isSubscriberSelectable(status: SubscriberListItem['status']): boolean {
  return status === 'SUBSCRIBED'
}

function RowCheckbox({ row }: { row: SubscriberListItem }) {
  const selection = useSubscribersSelection()
  const selectable = isSubscriberSelectable(row.status)
  const checked = selectable && selection.isSelected(row.id)

  const checkbox = (
    <Checkbox
      aria-label={`Select ${row.fullName}`}
      checked={checked}
      disabled={!selectable}
      onCheckedChange={() => selection.toggleRow(row.id, selectable)}
    />
  )

  if (selectable) return checkbox

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{checkbox}</TooltipTrigger>
      <TooltipContent>Unsubscribed contacts cannot be selected.</TooltipContent>
    </Tooltip>
  )
}

function HeaderCheckbox({ rows }: { rows: SubscriberListItem[] }) {
  const selection = useSubscribersSelection()
  const selectableIds = rows.filter((row) => isSubscriberSelectable(row.status)).map((row) => row.id)
  const allSelected = selection.areAllVisibleSelected(selectableIds)

  if (selectableIds.length === 0) return null

  return (
    <Checkbox
      aria-label="Select all visible rows"
      checked={allSelected}
      onCheckedChange={() => (allSelected ? selection.deselectVisible(selectableIds) : selection.selectVisible(selectableIds))}
    />
  )
}

const columnHelper = createColumnHelper<SubscriberListItem>()

const columns = [
  columnHelper.display({
    id: 'select',
    header: (info) => <HeaderCheckbox rows={info.table.getRowModel().rows.map((row) => row.original)} />,
    cell: (info) => <RowCheckbox row={info.row.original} />,
  }),
  columnHelper.accessor('fullName', {
    header: 'Name',
    cell: (info) => (
      <Link
        href={`/training/admin/subscribers/${info.row.original.id}`}
        className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('email', { header: 'Email' }),
  columnHelper.accessor('schoolName', { header: 'School' }),
  columnHelper.accessor('subject', { header: 'Subject' }),
  columnHelper.accessor('grade', { header: 'Grade' }),
  columnHelper.accessor('subscribedAt', {
    header: 'Date subscribed',
    cell: (info) => formatAdminTimestamp(info.getValue()),
  }),
  columnHelper.accessor('consentSource', {
    header: 'Source',
    cell: (info) => CONSENT_SOURCE_LABELS[info.getValue()] ?? info.getValue(),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <SubscriberStatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('lastMarketingEmailAt', {
    header: 'Last marketing email',
    cell: (info) => {
      const value = info.getValue()
      return value ? formatAdminTimestamp(value) : <span className="text-muted-foreground">—</span>
    },
  }),
  columnHelper.accessor('marketingEmailsSent', { header: 'Marketing emails sent' }),
]

export function SubscribersTable({
  rows,
  totalCount,
  page,
}: {
  rows: SubscriberListItem[]
  totalCount: number
  page: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const headerGroups = useMemo(() => table.getHeaderGroups(), [table])

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage + 1))
    router.push(`${pathname}?${params.toString()}`)
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No subscribers match these filters.</p>
  }

  const rangeStart = totalCount === 0 ? 0 : page * SUBSCRIBERS_PAGE_SIZE + 1
  const rangeEnd = Math.min(totalCount, (page + 1) * SUBSCRIBERS_PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <Table className="data-table">
        <TableHeader>
          {headerGroups.map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
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
