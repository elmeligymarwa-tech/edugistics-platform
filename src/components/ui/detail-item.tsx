import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

function DetailItem({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words text-foreground">{value}</p>
    </div>
  )
}

export { DetailItem }
