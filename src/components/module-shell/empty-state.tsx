import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateAction {
  label: string
  href: string
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: EmptyStateAction
  children?: ReactNode
}

/** Shared empty-state card: what this module does, and what to do next. */
export function EmptyState({ icon: Icon, title, description, action, children }: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="items-center gap-3 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div className="flex max-w-sm flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        {action ? (
          <Button size="sm" className="mt-1" render={<Link href={action.href} />}>
            {action.label}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
