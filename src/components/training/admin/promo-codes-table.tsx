'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAdminTimestamp, formatCourseFee } from '@/domain/training/format'
import { PROMO_CODE_PAGE_SIZE } from '@/domain/training/promo-code'
import type { PromoCodeListItem } from '@/lib/training/promo-codes'
import type { CourseOption } from './promo-code-course-multi-select'
import { ArchivePromoCodeDialog } from './archive-promo-code-dialog'
import { PromoCodeFormDialog } from './promo-code-form-dialog'
import { PromoCodePauseToggle } from './promo-code-pause-toggle'
import { PromoCodeStatusBadge } from './promo-code-status-badge'

const columnHelper = createColumnHelper<PromoCodeListItem>()

function formatDiscount(row: PromoCodeListItem): string {
  return row.discountType === 'PERCENTAGE' ? `${row.discountValue}%` : `${row.currency} ${row.discountValue}`
}

function buildColumns(courses: CourseOption[]) {
  return [
    columnHelper.accessor('code', {
      header: 'Code',
      cell: (info) => (
        <Link
          href={`/training/admin/promo-codes/${info.row.original.id}`}
          className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.display({
      id: 'discount',
      header: 'Discount',
      cell: (info) => (
        <span className="inline-flex items-center gap-1.5">
          {formatDiscount(info.row.original)}
          {info.row.original.currencyMismatch && (
            <span title="This code's currency doesn't match at least one eligible course's currency — it will be silently rejected at registration.">
              <TriangleAlert className="size-3.5 text-destructive" />
            </span>
          )}
        </span>
      ),
    }),
    columnHelper.accessor('appliesToLabel', { header: 'Courses' }),
    columnHelper.accessor('useCount', { header: 'Total uses' }),
    columnHelper.display({
      id: 'remainingUses',
      header: 'Uses remaining',
      cell: (info) => info.row.original.remainingUses ?? '—',
    }),
    columnHelper.display({
      id: 'totalDiscountGiven',
      header: 'Total discount given',
      cell: (info) => formatCourseFee(info.row.original.totalDiscountGiven, info.row.original.currency),
    }),
    columnHelper.display({
      id: 'potentialRegistrationValue',
      header: 'Potential registration value',
      cell: (info) => formatCourseFee(info.row.original.potentialRegistrationValue, info.row.original.currency),
    }),
    columnHelper.accessor('status', { header: 'Status', cell: (info) => <PromoCodeStatusBadge status={info.getValue()} /> }),
    columnHelper.accessor('expiresAt', {
      header: 'Expiry',
      cell: (info) => (info.getValue() ? formatAdminTimestamp(info.getValue()!) : '—'),
    }),
    columnHelper.display({
      id: 'pause',
      header: 'Active',
      cell: (info) => (
        <PromoCodePauseToggle
          promoCodeId={info.row.original.id}
          isPaused={info.row.original.isPaused}
          disabled={Boolean(info.row.original.archivedAt)}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <div className="flex items-center justify-end gap-1">
          <PromoCodeFormDialog promoCode={info.row.original} courses={courses} />
          {!info.row.original.archivedAt && (
            <ArchivePromoCodeDialog promoCodeId={info.row.original.id} code={info.row.original.code} />
          )}
        </div>
      ),
    }),
  ]
}

export function PromoCodesTable({
  rows,
  totalCount,
  page,
  courses,
}: {
  rows: PromoCodeListItem[]
  totalCount: number
  page: number
  courses: CourseOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const columns = useMemo(() => buildColumns(courses), [courses])
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const headerGroups = useMemo(() => table.getHeaderGroups(), [table])

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage + 1))
    router.push(`${pathname}?${params.toString()}`)
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No promo codes match these filters.</p>
  }

  const rangeStart = totalCount === 0 ? 0 : page * PROMO_CODE_PAGE_SIZE + 1
  const rangeEnd = Math.min(totalCount, (page + 1) * PROMO_CODE_PAGE_SIZE)

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
