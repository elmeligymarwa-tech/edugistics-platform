import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { trainingPrisma?: PrismaClient }

/**
 * The analytics dashboard alone issues ~20 concurrent queries per page
 * render (see analytics.ts) — every KPI, chart and table fetches
 * independently so filters can apply consistently and each metric keeps
 * exactly one authoritative implementation, rather than being derived from
 * a shared blob. Prisma's own client-side connection pool defaults to
 * `num_physical_cpus * 2 + 1`, unrelated to that and typically tiny on a
 * serverless function (as low as 3–5) — nowhere near enough, so most of
 * those 20 queries queue up *inside the Node process* waiting for a free
 * connection rather than actually running concurrently, and each one still
 * pays the full round-trip latency to Supabase's pooler once it gets a
 * turn. DATABASE_URL already routes through pgbouncer in transaction mode,
 * so raising Prisma's pool here doesn't open more real Postgres connections
 * — it lets more of that already-pooled connection budget be used
 * concurrently instead of serialising behind Prisma's own default.
 */
function withConnectionPoolSize(url: string): string {
  const parsed = new URL(url)
  if (!parsed.searchParams.has('connection_limit')) parsed.searchParams.set('connection_limit', '15')
  if (!parsed.searchParams.has('pool_timeout')) parsed.searchParams.set('pool_timeout', '20')
  return parsed.toString()
}

export const prisma =
  globalForPrisma.trainingPrisma ??
  new PrismaClient({
    datasources: { db: { url: withConnectionPoolSize(process.env.DATABASE_URL!) } },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.trainingPrisma = prisma
}
