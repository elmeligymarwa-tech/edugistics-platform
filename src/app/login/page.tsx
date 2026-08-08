import type { Metadata } from 'next'
import Image from 'next/image'

import { toSafeInternalPath } from '@/lib/auth/safe-redirect'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — Edugistics',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  const redirectTo = toSafeInternalPath(from) ?? '/dashboard'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/brand/logo-light.png"
            alt="Edugistics"
            width={900}
            height={649}
            priority
            className="h-auto w-40 dark:hidden"
          />
          <Image
            src="/brand/logo-dark.png"
            alt="Edugistics"
            width={900}
            height={649}
            priority
            className="hidden h-auto w-40 dark:block"
          />
          <p className="text-center text-sm text-muted-foreground">
            School financial planning — sign in with the shared workspace password.
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  )
}
