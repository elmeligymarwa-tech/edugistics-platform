import Link from 'next/link'
import { redirect } from 'next/navigation'

import { isAdminAuthenticated } from '@/lib/training/auth/require-admin'
import { TrainingAdminSignOutButton } from '@/components/training/admin/sign-out-button'

export default async function TrainingAdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    redirect('/training/admin/login')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <nav className="flex items-center gap-4">
          <span className="text-sm font-medium text-heading">Edugistics Training</span>
          <Link href="/training/admin/courses" className="text-sm text-muted-foreground hover:text-foreground">
            Courses
          </Link>
        </nav>
        <TrainingAdminSignOutButton />
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  )
}
