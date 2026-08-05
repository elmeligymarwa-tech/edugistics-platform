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
    <Card>
      <CardContent className="items-start gap-3 pt-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        {action ? (
          <Button size="sm" render={<Link href={action.href} />}>
            {action.label}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
