import Link from 'next/link'
import { Compass } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="items-start gap-3 pt-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Compass className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Page not found</p>
            <p className="text-sm text-muted-foreground">
              There&apos;s nothing at this address. Go back to the dashboard to keep working on your
              forecast.
            </p>
          </div>
          <Button size="sm" render={<Link href="/app/dashboard" />}>
            Go to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
