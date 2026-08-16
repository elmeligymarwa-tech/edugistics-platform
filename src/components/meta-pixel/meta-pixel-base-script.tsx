'use client'

import Script from 'next/script'

/**
 * Assumes the caller (MetaPixelGate) has already decided this is a public,
 * trackable page and that META_PIXEL_ID is set — this component doesn't
 * re-check either, it just renders the tag.
 *
 * Deliberately stops at `fbq('init', ...)` — it never calls
 * `fbq('track', 'PageView')` itself. PageView firing is owned entirely by
 * MetaPixelGate's route-change effect, so first load and every later
 * client-side navigation go through exactly one code path instead of this
 * snippet firing once on load and the route tracker firing again for the
 * same initial pathname.
 */
export function MetaPixelBaseScript({ pixelId }: { pixelId: string }) {
  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- standard Meta Pixel noscript fallback, not an optimisable content image */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
