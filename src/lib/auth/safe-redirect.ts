/**
 * Restricts post-login redirect targets to same-origin, path-only destinations.
 * Rejects protocol-relative ("//host"), backslash-based, and absolute URLs to
 * prevent an open redirect via a crafted `from` query parameter.
 */
export function toSafeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null
  if (!candidate.startsWith('/')) return null
  if (candidate.startsWith('//')) return null
  if (candidate.includes('\\')) return null
  return candidate
}
