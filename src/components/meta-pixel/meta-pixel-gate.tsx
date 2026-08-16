'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { isPublicTrackedPath, META_PIXEL_ID } from '@/lib/meta-pixel/config'
import { trackPageView } from '@/lib/meta-pixel/events'
import { MetaPixelBaseScript } from './meta-pixel-base-script'

/**
 * Mounted once in the root layout, so it sees every route in the app —
 * /app/*, /training/admin/* and the public pages alike. isPublicTrackedPath
 * is an allowlist, not a blocklist: any route not explicitly listed there
 * renders nothing here, so admin and app-shell pages (which carry teacher
 * names, emails, phone numbers and school data in their URLs and content)
 * never load the pixel, load fbevents.js, or send anything to Meta —
 * regardless of where this component happens to be mounted in the tree.
 *
 * Next.js client-side navigation doesn't re-run this component's initial
 * mount effect, so a PageView fired only on mount would undercount teachers
 * moving between public pages. Firing from an effect keyed on `pathname`
 * covers first load (the effect also runs on mount) and every later
 * route change with the same single call, so neither case is missed or
 * double-counted.
 */
export function MetaPixelGate() {
  const pathname = usePathname()
  const isTracked = Boolean(META_PIXEL_ID) && isPublicTrackedPath(pathname)

  useEffect(() => {
    // MetaPixelBaseScript is a child of this component, so React flushes its
    // <Script> injection effect (which defines window.fbq) before this
    // effect runs — trackPageView never races an undefined window.fbq.
    if (!isTracked) return
    trackPageView()
  }, [pathname, isTracked])

  if (!isTracked || !META_PIXEL_ID) return null

  return <MetaPixelBaseScript pixelId={META_PIXEL_ID} />
}
