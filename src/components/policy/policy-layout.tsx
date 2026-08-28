import type { ReactNode } from 'react'

import { SiteHeader } from '@/components/site-header'

import { POLICY_BODY_FONT } from './policy-typography'
import { PolicyFooter } from './policy-footer'

export function PolicyLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`flex min-h-dvh flex-col bg-white ${POLICY_BODY_FONT}`}>
      <SiteHeader />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-[720px]">{children}</div>
      </main>
      <PolicyFooter />
    </div>
  )
}
