// Not marked 'server-only': scripts/training-reset.mts and
// vitest.database-guard.ts also need PRODUCTION_PROJECT_REF, and this module
// is pure and side-effect-free either way. The actual read of
// process.env.DATABASE_URL for display in the UI happens only inside
// database-environment-badge.tsx and the getDatabaseEnvironmentBadgeAction
// server action — never here, and never sent to the client as anything more
// than the resulting label.

/** The live production Supabase project that edugistics.online/training reads from. Keep in sync with vitest.database-guard.ts's own copy of this ref. */
export const PRODUCTION_PROJECT_REF = 'ndkhfqhyuglwtpwlxrxo'

/** The dedicated test/dev Supabase project — see TEST-DATABASE.md. */
export const TEST_PROJECT_REF = 'paipadncvmjikeedxnth'

export type DatabaseEnvironment = 'PRODUCTION' | 'TEST' | 'UNKNOWN'

/**
 * Identifies which Supabase project the resolved DATABASE_URL actually
 * points at, from the connection string itself — never from NODE_ENV, which
 * says nothing about which database is connected (a production build run
 * locally still reports NODE_ENV=production regardless of DATABASE_URL).
 * Anything that isn't a recognised project ref — unset, unparseable, a
 * renamed or rotated ref — resolves to UNKNOWN rather than being assumed
 * safe. See databaseEnvironmentBadgeInfo: UNKNOWN fails loud by design.
 */
export function resolveDatabaseEnvironment(databaseUrl: string | undefined): DatabaseEnvironment {
  if (databaseUrl?.includes(PRODUCTION_PROJECT_REF)) return 'PRODUCTION'
  if (databaseUrl?.includes(TEST_PROJECT_REF)) return 'TEST'
  return 'UNKNOWN'
}

export interface DatabaseEnvironmentBadgeInfo {
  label: 'TEST DATABASE' | 'UNKNOWN DATABASE'
  variant: 'warning' | 'destructive'
}

/**
 * PRODUCTION renders nothing — the normal admin, unchanged. Everything
 * else renders visibly, deliberately: a database that isn't recognised as
 * either project is exactly the case that must never look like a clean
 * admin, since that's indistinguishable from production at a glance.
 */
export function databaseEnvironmentBadgeInfo(environment: DatabaseEnvironment): DatabaseEnvironmentBadgeInfo | null {
  if (environment === 'PRODUCTION') return null
  if (environment === 'TEST') return { label: 'TEST DATABASE', variant: 'warning' }
  return { label: 'UNKNOWN DATABASE', variant: 'destructive' }
}
