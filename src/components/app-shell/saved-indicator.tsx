'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudUpload } from 'lucide-react'

import { useSaveStatus } from '@/store/project-store'
import { formatRelativeTime } from '@/lib/format'

export function SavedIndicator() {
  const status = useSaveStatus((state) => state.status)
  const lastSavedAt = useSaveStatus((state) => state.lastSavedAt)
  const [, forceTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => forceTick((tick) => tick + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  if (status === 'idle') return null

  return (
    <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
      {status === 'pending' ? (
        <>
          <CloudUpload className="size-3.5 animate-pulse" aria-hidden="true" />
          Saving…
        </>
      ) : (
        <>
          <Cloud className="size-3.5" aria-hidden="true" />
          Saved {lastSavedAt ? formatRelativeTime(lastSavedAt) : ''}
        </>
      )}
    </div>
  )
}
