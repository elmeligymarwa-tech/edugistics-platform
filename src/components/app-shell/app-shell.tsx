import type { ReactNode } from 'react'

import { ConsultantMount } from '@/components/consultant/consultant-mount'
import { CostModelSync } from './cost-model-sync'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background print:h-auto print:overflow-visible">
      <CostModelSync />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col print:overflow-visible">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 print:h-auto print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
      <ConsultantMount />
    </div>
  )
}
