import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAdminTimestamp } from '@/domain/training/format'
import type { WaitlistRow } from '@/lib/training/waitlist'
import { PromoteRegistrationButton } from './promote-registration-button'

export function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No one is currently on the waiting list.</p>
  }

  return (
    <Table className="data-table">
      <TableHeader>
        <TableRow>
          <TableHead>Position</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Full name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>School</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium text-foreground">{row.waitlistPosition}</TableCell>
            <TableCell>{row.reference}</TableCell>
            <TableCell>{row.fullName}</TableCell>
            <TableCell>{row.email}</TableCell>
            <TableCell>{row.phone}</TableCell>
            <TableCell>{row.schoolName}</TableCell>
            <TableCell>{formatAdminTimestamp(row.registeredAt)}</TableCell>
            <TableCell className="text-right">
              <PromoteRegistrationButton registrationId={row.id} fullName={row.fullName} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
