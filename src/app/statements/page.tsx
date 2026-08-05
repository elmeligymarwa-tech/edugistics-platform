'use client'

import { FileText } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { useActiveProject, useHasHydrated } from '@/store/project-store'

export default function StatementsPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()

  return (
    <>
      <PageHeader title="Statements" description="Generated financial statements by year." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={FileText}
          title="No project yet"
          description="Complete setup before financial statements can be generated."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {hasHydrated && project ? (
        <EmptyState
          icon={FileText}
          title="Financial statements aren't available yet"
          description="This module will combine the revenue forecast with staffing costs and operational expenses to produce a profit and loss statement, cash flow and balance sheet for each forecast year. It depends on the Expenses module, which isn't built yet — there's nothing to configure here yet."
        />
      ) : null}
    </>
  )
}
