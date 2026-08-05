'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

import { navItemForPath } from '@/lib/navigation'

export function Breadcrumbs() {
  const pathname = usePathname()
  const item = navItemForPath(pathname)

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link
        href="/dashboard"
        className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Edugistics
      </Link>
      {item ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate font-medium text-foreground">{item.title}</span>
        </>
      ) : null}
    </nav>
  )
}
