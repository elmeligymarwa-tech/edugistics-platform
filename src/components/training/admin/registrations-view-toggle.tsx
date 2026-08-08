'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

export type RegistrationsView = 'all' | 'course'

export function RegistrationsViewToggle({ view }: { view: RegistrationsView }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setView(nextView: RegistrationsView) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextView === 'all') params.delete('view')
    else params.set('view', nextView)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1">
      <Button
        type="button"
        variant={view === 'all' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('all')}
        aria-pressed={view === 'all'}
      >
        All registrations
      </Button>
      <Button
        type="button"
        variant={view === 'course' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('course')}
        aria-pressed={view === 'course'}
      >
        By course
      </Button>
    </div>
  )
}
