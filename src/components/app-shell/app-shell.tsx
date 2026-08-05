import type { ReactNode } from 'react'

import { CostModelSync } from './cost-model-sync'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <CostModelSync />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
