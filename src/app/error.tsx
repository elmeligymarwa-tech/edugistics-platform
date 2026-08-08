'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="items-start gap-3 pt-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              This page hit an unexpected error. Try again, or head back to the dashboard — your project
              data is saved locally and hasn&apos;t been affected.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={reset}>
              Try again
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/app/dashboard" />}>
              Go to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
