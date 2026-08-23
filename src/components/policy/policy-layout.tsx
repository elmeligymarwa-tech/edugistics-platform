import type { ReactNode } from 'react'

import { PolicyFooter } from './policy-footer'
import { PolicyHeader } from './policy-header'

export function PolicyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PolicyHeader />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-[720px]">{children}</div>
      </main>
      <PolicyFooter />
    </div>
  )
}
