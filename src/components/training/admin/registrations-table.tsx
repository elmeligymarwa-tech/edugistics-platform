'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAdminTimestamp } from '@/domain/training/format'
import { REGISTRATIONS_PAGE_SIZE } from '@/domain/training/schema'
import type { RegistrationListItem } from '@/lib/training/registrations'
import { EmailStatusBadge, RegistrationStatusBadge } from './registration-badges'
import { RegistrationRowActions } from './registration-row-actions'

const columnHelper = createColumnHelper<RegistrationListItem>()

const columns = [
  columnHelper.accessor('registeredAt', {
    header: 'Registered',
    cell: (info) => formatAdminTimestamp(info.getValue()),
  }),
  columnHelper.accessor('reference', { header: 'Reference' }),
  columnHelper.accessor('courseName', { header: 'Course' }),
  columnHelper.accessor('fullName', { header: 'Full name' }),
  columnHelper.accessor('email', { header: 'Email' }),
  columnHelper.accessor('phone', { header: 'Phone' }),
  columnHelper.accessor('schoolName', { header: 'School' }),
  columnHelper.accessor('subject', { header: 'Subject' }),
  columnHelper.accessor('grade', { header: 'Grade' }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <RegistrationStatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('marketingConsent', {
    header: 'Consent',
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }),
  columnHelper.accessor('emailStatus', {
    header: 'Email status',
    cell: (info) => <EmailStatusBadge status={info.getValue()} />,
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: (info) => <RegistrationRowActions registration={info.row.original} />,
  }),
]

export function RegistrationsTable({
  rows,
  totalCount,
  page,
}: {
  rows: RegistrationListItem[]
  totalCount: number
  page: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalCount / REGISTRATIONS_PAGE_SIZE)),
  })

  const rangeStart = totalCount === 0 ? 0 : page * REGISTRATIONS_PAGE_SIZE + 1
  const rangeEnd = Math.min(totalCount, (page + 1) * REGISTRATIONS_PAGE_SIZE)

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage + 1))
    router.push(`${pathname}?${params.toString()}`)
  }

  const headerGroups = useMemo(() => table.getHeaderGroups(), [table])

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No registrations match these filters.</p>
  }

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={rangeEnd >= totalCount}
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
