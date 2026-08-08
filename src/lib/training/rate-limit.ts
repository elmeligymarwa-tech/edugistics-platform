interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

/**
 * In-memory sliding-window limiter. Resets on cold start and is not shared
 * across serverless instances — a first layer, not a durable guarantee.
 * Sufficient alongside argon2's inherent slowness for admin login; revisit
 * with a durable store (e.g. Redis) if public registration traffic grows.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now - entry.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= limit) return false
  entry.count += 1
  return true
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
