import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Breadcrumbs } from './breadcrumbs'
import { MobileNav } from './mobile-nav'
import { ProjectSwitcher } from './project-switcher'
import { SavedIndicator } from './saved-indicator'
import { UsdToggle } from './usd-toggle'

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 print:hidden">
      <MobileNav />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-3">
        <SavedIndicator />
        <UsdToggle />
        <ProjectSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}
