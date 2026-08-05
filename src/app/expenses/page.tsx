'use client'

import { Receipt } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { useActiveProject, useHasHydrated } from '@/store/project-store'

export default function ExpensesPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()

  return (
    <>
      <PageHeader title="Expenses" description="Operating costs outside staffing." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={Receipt}
          title="No project yet"
          description="Complete setup before recording operational expenses."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {hasHydrated && project ? (
        <EmptyState
          icon={Receipt}
          title="Operational expenses aren't captured yet"
          description="This module will record costs outside staffing — utilities, facilities, marketing and insurance — and roll them into the financial statements alongside revenue and payroll. There's nothing to configure here yet."
        />
      ) : null}
    </>
  )
}
