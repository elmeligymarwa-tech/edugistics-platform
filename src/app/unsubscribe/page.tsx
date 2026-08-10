import type { Metadata } from 'next'

import { resolveUnsubscribeToken } from '@/lib/training/unsubscribe'
import { UnsubscribeConfirm } from '@/components/training/public/unsubscribe-confirm'

export const metadata: Metadata = {
  title: 'Unsubscribe — Edugistics',
}

interface UnsubscribeSearchParams {
  token?: string
}

/**
 * Server component only reads the token to display a masked email — it
 * never unsubscribes anyone on load. Email clients and security scanners
 * pre-fetch links, so acting here would unsubscribe people who never
 * clicked Confirm.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<UnsubscribeSearchParams> }) {
  const { token } = await searchParams

  const info = token ? await resolveUnsubscribeToken(token) : null

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16">
      {info && token ? (
        <UnsubscribeConfirm token={token} maskedEmail={info.maskedEmail} alreadyUnsubscribed={info.alreadyUnsubscribed} />
      ) : (
        <div className="w-full max-w-md text-center">
          <h1 className="font-heading text-xl text-heading">This unsubscribe link is not valid.</h1>
        </div>
      )}
    </main>
  )
}
