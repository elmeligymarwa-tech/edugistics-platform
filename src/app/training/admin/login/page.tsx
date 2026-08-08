import type { Metadata } from 'next'

import { toSafeInternalPath } from '@/lib/auth/safe-redirect'
import { AdminLoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Admin sign in — Edugistics Training',
}

export default async function TrainingAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  const redirectTo = toSafeInternalPath(from) ?? '/training/admin/courses'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-lg font-medium text-heading">Edugistics Training</p>
          <p className="text-center text-sm text-muted-foreground">Admin sign in</p>
        </div>
        <AdminLoginForm redirectTo={redirectTo} />
      </div>
    </div>
  )
}
