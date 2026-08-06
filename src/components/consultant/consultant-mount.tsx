'use client'

import { useActiveProject, useHasHydrated } from '@/store/project-store'
import { ConsultantPanel } from './consultant-panel'

/**
 * Mounted once in AppShell so the consultant rail appears on every page —
 * setup wizard, presentation mode, and every module page — without
 * threading a slot through each page's layout individually. Renders
 * nothing until IndexedDB rehydration resolves and there is an active
 * project (project-list/settings screens with no project selected get no
 * panel).
 */
export function ConsultantMount() {
  const hasHydrated = useHasHydrated()
  const project = useActiveProject()

  if (!hasHydrated || !project) return null

  return <ConsultantPanel project={project} />
}
