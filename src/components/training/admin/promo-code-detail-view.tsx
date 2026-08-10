import { StatTile } from '@/components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAdminTimestamp, formatCourseFee } from '@/domain/training/format'
import { formatPromoDiscountLabel } from '@/domain/training/promo-code'
import type { PromoCodeDetail } from '@/lib/training/promo-codes'
import { PromoCodeStatusBadge } from './promo-code-status-badge'
import { RegistrationStatusBadge } from './registration-badges'

/**
 * Every figure here comes straight from getPromoCodeDetail — the one
 * authoritative implementation of these totals (src/lib/training/promo-codes.ts).
 * The registrations table below shows every registration that ever used
 * this code, including CANCELLED ones, each marked with its own status —
 * but CANCELLED rows are excluded from the totals above, exactly as
 * summarisePromoCodeUsage defines.
 */
export function PromoCodeDetailView({ detail }: { detail: PromoCodeDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-heading">{detail.code}</h1>
          <p className="text-sm text-muted-foreground">{detail.description}</p>
        </div>
        <PromoCodeStatusBadge status={detail.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Discount" value={formatPromoDiscountLabel(detail.discountType, detail.discountValue, detail.currency)} />
        <StatTile label="Courses" value={detail.appliesToLabel} />
        <StatTile label="Total uses" value={detail.totalUses} />
        <StatTile label="Uses remaining" value={detail.remainingUses ?? '—'} />
        <StatTile label="Total discount given" value={formatCourseFee(detail.totalDiscountGiven, detail.currency)} />
        <StatTile label="Potential registration value" value={formatCourseFee(detail.potentialRegistrationValue, detail.currency)} />
        <StatTile label="Max uses per teacher" value={detail.maxUsesPerTeacher} />
        <StatTile
          label="Per-teacher limit applies"
          value={detail.maxUsesPerTeacherScope === 'PER_COURSE' ? 'Per course' : 'Across all courses'}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Potential Registration Value and Total Discount Given are informational only — payment is collected outside
        this system, not through it.
      </p>

      {detail.registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">This code has never been used.</p>
      ) : (
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Original fee</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Final fee</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.registrations.map((registration) => (
              <TableRow key={registration.registrationId}>
                <TableCell>{registration.teacherFullName}</TableCell>
                <TableCell>{registration.teacherEmail}</TableCell>
                <TableCell>{registration.courseName}</TableCell>
                <TableCell>{formatAdminTimestamp(registration.registeredAt)}</TableCell>
                <TableCell>{formatCourseFee(registration.originalFee, detail.currency)}</TableCell>
                <TableCell>{formatCourseFee(registration.discountAmount, detail.currency)}</TableCell>
                <TableCell>{formatCourseFee(registration.finalFee, detail.currency)}</TableCell>
                <TableCell>
                  <RegistrationStatusBadge status={registration.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
