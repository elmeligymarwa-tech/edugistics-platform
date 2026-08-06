import Image from 'next/image'
import Link from 'next/link'

import { SidebarNav } from './sidebar-nav'

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col print:hidden">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard" className="block w-fit" aria-label="Edugistics — Dashboard">
          <Image
            src="/brand/logo-light.png"
            alt="Edugistics"
            width={900}
            height={649}
            priority
            className="h-auto w-36 dark:hidden"
          />
          <Image
            src="/brand/logo-dark.png"
            alt="Edugistics"
            width={900}
            height={649}
            priority
            className="hidden h-auto w-36 dark:block"
          />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav />
      </div>
    </aside>
  )
}
