import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface ConfirmedConfirmation {
  status: 'CONFIRMED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  courseDateLong: string
  courseTimeRange: string
}

export interface WaitlistedConfirmation {
  status: 'WAITLISTED'
  reference: string
  teacherFullName: string
  teacherEmail: string
  courseName: string
  waitlistPosition: number
}

export type Confirmation = ConfirmedConfirmation | WaitlistedConfirmation

export function ConfirmationCard({
  confirmation,
  onRegisterAnother,
}: {
  confirmation: Confirmation
  onRegisterAnother: () => void
}) {
  const isConfirmed = confirmation.status === 'CONFIRMED'

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col gap-4 pt-4">
        <div>
          <h1 className="font-heading text-2xl text-heading">
            {isConfirmed ? 'Registration confirmed' : 'You are on the waiting list'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you, {confirmation.teacherFullName}.
          </p>
        </div>

        {isConfirmed ? (
          <div className="flex flex-col gap-1 text-sm">
            <p>
              You are registered for: <span className="font-semibold text-foreground">{confirmation.courseName}</span>
            </p>
            <p className="text-muted-foreground">{confirmation.courseDateLong}</p>
            <p className="text-muted-foreground">{confirmation.courseTimeRange}</p>
          </div>
        ) : (
          <p className="text-sm">
            <span className="font-semibold text-foreground">{confirmation.courseName}</span> is currently full. You
            are number <span className="font-semibold text-foreground">{confirmation.waitlistPosition}</span> on the
            waiting list. We will email you if a place becomes available.
          </p>
        )}

        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>
            Reference: <span className="font-mono font-medium text-foreground">{confirmation.reference}</span>
          </p>
          {isConfirmed && (
            <p className="mt-1 text-muted-foreground">Confirmation email sent to: {confirmation.teacherEmail}</p>
          )}
        </div>

        <Button onClick={onRegisterAnother} className="w-full">
          Register for another course
        </Button>
      </CardContent>
    </Card>
  )
}
