// Vitest globalSetup entry — runs before any test file loads (see
// vitest.config.mts, where this is listed FIRST in `globalSetup`, ahead of
// vitest.global-teardown.ts, so this can abort the whole run before that
// file's sweep ever opens a database connection).
//
// Why this exists: on 17 August the full test suite was run directly
// against the live production Supabase database — an explicit instruction
// in a prompt outranked the written rule in CLAUDE.md that forbids it. A
// written rule loses that argument; a guard that hard-fails the process
// does not. See CLAUDE.md, "Test suite writes to the production database".
//
// Detection uses two independent signals. Both must pass, and neither can
// be satisfied by the other:
//
//   1. Denylist — DATABASE_URL must not reference the production Supabase
//      project (ref "ndkhfqhyuglwtpwlxrxo"). This check never consults any
//      other variable, so nothing can talk it out of firing.
//
//   2. Allowlist — TEST_DATABASE_URL must be set and byte-for-byte equal to
//      DATABASE_URL. This is a deliberate, explicit opt-in: whoever set up
//      this environment copied the exact URL of a database they have
//      decided is safe for tests to create rows in and delete from. An
//      unrecognised database with no such marker fails closed rather than
//      being assumed safe.
//
// There is no environment variable, CLI flag, or config option that skips
// either check. That is intentional — see the prompt for this task.

function loadEnvFileIfPresent(path: string): void {
  try {
    process.loadEnvFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

// @prisma/client auto-loads `.env` into process.env the moment it's
// imported — that's what actually determines which database every
// *.test.ts file in this project connects to (see CLAUDE.md). This module
// runs before that import happens anywhere else, so it loads the same file
// explicitly here rather than assuming process.env is already populated.
// `.env.local` is loaded too (without overriding `.env`) since that's where
// TEST_DATABASE_URL is documented in .env.local.example.
loadEnvFileIfPresent('.env')
loadEnvFileIfPresent('.env.local')

const PRODUCTION_PROJECT_REF = 'ndkhfqhyuglwtpwlxrxo'

function describeDatabase(url: string | undefined): string {
  if (!url) return '(not set)'
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return '(unparseable connection string)'
  }
}

function abortMessage(title: string, lines: string[]): string {
  const rule = '='.repeat(70)
  return ['', rule, `TEST RUN ABORTED — ${title}`, rule, ...lines, rule].join('\n')
}

/**
 * Throws with a plain-language explanation if `env.DATABASE_URL` is not
 * safe for the test suite to run against. Takes an explicit env object
 * (rather than reading `process.env` itself) so it can be unit-tested with
 * fabricated inputs — see vitest.database-guard.test.ts.
 */
export function checkDatabaseIsSafeForTests(env: Record<string, string | undefined>): void {
  const databaseUrl = env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      abortMessage('no database to run tests against', [
        'DATABASE_URL is not set. Tests refuse to guess a database.',
        '',
        'What to do instead:',
        '  Set DATABASE_URL to a dedicated test database, and set',
        '  TEST_DATABASE_URL to that exact same value. See .env.local.example.',
      ]),
    )
  }

  if (databaseUrl.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(
      abortMessage('DATABASE_URL points at production', [
        `Detected database: ${describeDatabase(databaseUrl)}`,
        `This is the live production Supabase project (ref "${PRODUCTION_PROJECT_REF}")`,
        'that edugistics.online/training reads from. Tests must never run against it.',
        '',
        'What to do instead:',
        '  Point DATABASE_URL at a dedicated test database, and set',
        '  TEST_DATABASE_URL to that exact same value. See .env.local.example.',
      ]),
    )
  }

  const testDatabaseUrl = env.TEST_DATABASE_URL
  if (!testDatabaseUrl || testDatabaseUrl !== databaseUrl) {
    throw new Error(
      abortMessage('database is not marked safe for tests', [
        `Detected database: ${describeDatabase(databaseUrl)}`,
        testDatabaseUrl
          ? 'TEST_DATABASE_URL is set but does not match DATABASE_URL exactly.'
          : 'TEST_DATABASE_URL is not set.',
        'An unrecognised database is treated as unsafe by default — nothing is',
        'assumed safe just because it does not look like production.',
        '',
        'What to do instead:',
        '  Set TEST_DATABASE_URL to the exact same value as DATABASE_URL to',
        '  confirm this is a dedicated test database. See .env.local.example.',
      ]),
    )
  }
}

export default function globalSetup(): void {
  checkDatabaseIsSafeForTests(process.env)
}
