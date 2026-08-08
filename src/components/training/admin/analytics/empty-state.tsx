export function AnalyticsEmptyState({ message = 'No data for the current filters.' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
