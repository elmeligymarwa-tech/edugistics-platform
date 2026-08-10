import 'server-only'

/** The one place the site's own absolute base URL is read from — needed server-side to build links (e.g. the unsubscribe link) that go inside an email rather than a browser response. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}
