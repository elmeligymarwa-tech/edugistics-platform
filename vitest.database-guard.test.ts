// Unit tests for checkDatabaseIsSafeForTests. These pass fabricated env
// objects directly to the function — they never read real process.env and
// never touch a database, so they're safe to run against whatever
// DATABASE_URL happens to be configured locally.
//
// Run in isolation via `npm run test:db-guard` (vitest.database-guard.config.mts),
// which has no globalSetup: wiring the real guard as globalSetup here would
// make this file's own run depend on a locally-configured safe test
// database before it could even load — see that config file's comment.
import { describe, expect, it } from 'vitest'

import { checkDatabaseIsSafeForTests } from './vitest.database-guard'

const PROD_URL = 'postgresql://postgres.ndkhfqhyuglwtpwlxrxo:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
const TEST_URL = 'postgresql://postgres:secret@localhost:5432/edugistics_test'
const OTHER_TEST_URL = 'postgresql://postgres:secret@localhost:5432/some_other_db'

describe('checkDatabaseIsSafeForTests', () => {
  it('throws when DATABASE_URL is unset', () => {
    expect(() => checkDatabaseIsSafeForTests({})).toThrow(/DATABASE_URL is not set/)
  })

  it('throws when DATABASE_URL is the production project, with no marker at all', () => {
    expect(() => checkDatabaseIsSafeForTests({ DATABASE_URL: PROD_URL })).toThrow(/points at production/)
  })

  it('throws when DATABASE_URL is the production project, even if TEST_DATABASE_URL matches it exactly', () => {
    // The production denylist check must never be satisfiable by the
    // allowlist marker — otherwise the marker would be a bypass.
    expect(() =>
      checkDatabaseIsSafeForTests({ DATABASE_URL: PROD_URL, TEST_DATABASE_URL: PROD_URL }),
    ).toThrow(/points at production/)
  })

  it('throws when DATABASE_URL is an unrecognised database with no TEST_DATABASE_URL set', () => {
    expect(() => checkDatabaseIsSafeForTests({ DATABASE_URL: TEST_URL })).toThrow(/not marked safe for tests/)
  })

  it('throws when DATABASE_URL is an unrecognised database and TEST_DATABASE_URL points elsewhere', () => {
    expect(() =>
      checkDatabaseIsSafeForTests({ DATABASE_URL: TEST_URL, TEST_DATABASE_URL: OTHER_TEST_URL }),
    ).toThrow(/not marked safe for tests/)
  })

  it('does not throw when DATABASE_URL is a non-production database and TEST_DATABASE_URL matches it exactly', () => {
    expect(() =>
      checkDatabaseIsSafeForTests({ DATABASE_URL: TEST_URL, TEST_DATABASE_URL: TEST_URL }),
    ).not.toThrow()
  })

  it('prints the exact failure output for the production case, for someone reading at speed', () => {
    let message = ''
    try {
      checkDatabaseIsSafeForTests({ DATABASE_URL: PROD_URL })
    } catch (error) {
      message = (error as Error).message
    }
    console.log(message)
    expect(message).toContain('TEST RUN ABORTED')
    expect(message).toContain('aws-1-eu-west-1.pooler.supabase.com')
    expect(message).toContain('ndkhfqhyuglwtpwlxrxo')
    expect(message).toContain('TEST_DATABASE_URL')
  })
})
