import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder shown while project data is still being read from IndexedDB. */
export function ModuleLoading() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="gap-2 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </Card>
        ))}
      </div>
      <Card aria-hidden="true">
        <CardContent className="gap-3 pt-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
