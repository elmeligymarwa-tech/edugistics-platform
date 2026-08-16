/**
 * Public by nature — this is a client-visible pixel ID, not a secret. Absent
 * in any environment where NEXT_PUBLIC_META_PIXEL_ID isn't set, in which
 * case the pixel simply never loads.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

/**
 * Explicit allowlist of routes the pixel may load on — never a blocklist of
 * admin/app paths. A new route is excluded by default; it has to be added
 * here deliberately before it ever receives tracking. This is what actually
 * keeps the pixel off /training/admin/* and /app/* — not where the
 * component happens to be mounted in the tree.
 */
const PUBLIC_TRACKED_PATHS = new Set(['/', '/training', '/training/privacy', '/unsubscribe'])

export function isPublicTrackedPath(pathname: string): boolean {
  return PUBLIC_TRACKED_PATHS.has(pathname)
}
