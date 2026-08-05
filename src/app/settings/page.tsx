'use client'

import Link from 'next/link'
import { Settings as SettingsIcon } from 'lucide-react'

import { PageHeader } from '@/components/app-shell/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/module-shell/empty-state'
import { ModuleLoading } from '@/components/module-shell/module-loading'
import { SettingsData } from '@/components/settings/settings-data'
import { SettingsOverview } from '@/components/settings/settings-overview'
import { useActiveProject, useHasHydrated } from '@/store/project-store'

export default function SettingsPage() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()

  return (
    <>
      <PageHeader title="Settings" description="Currency, locale and workspace preferences." />
      {!hasHydrated ? <ModuleLoading /> : null}
      {hasHydrated && !project ? (
        <EmptyState
          icon={SettingsIcon}
          title="No project yet"
          description="Complete setup to configure workspace preferences."
          action={{ label: 'Go to setup', href: '/setup' }}
        />
      ) : null}
      {hasHydrated && project ? (
        <div className="flex flex-col gap-4">
          <SettingsOverview project={project} />
          <div>
            <Button size="sm" variant="outline" render={<Link href="/setup?step=1" />}>
              Edit in setup
            </Button>
          </div>
          <SettingsData project={project} />
        </div>
      ) : null}
    </>
  )
}
