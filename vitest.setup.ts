// ============================================================================
// A dedicated test database exists at Supabase project ref
// paipadncvmjikeedxnth, separate from the production project
// (ndkhfqhyuglwtpwlxrxo) that edugistics.online/training reads from.
// .env.test holds its three variables (DATABASE_URL, DIRECT_URL,
// TEST_DATABASE_URL). `npm run testdb:run` is the safe, correct way to run
// this suite — it loads .env.test and points every test at that project.
//
// `npm test` and a bare `vitest run` must never be used: neither loads any
// env file, so DATABASE_URL/TEST_DATABASE_URL are unset (or whatever the
// shell happens to have), and vitest.database-guard.ts — Vitest's first
// globalSetup step, running before any test file loads — aborts the run
// rather than risk touching the wrong database.
//
// vitest.database-guard.ts enforces that TEST_DATABASE_URL is set and is
// byte-for-byte equal to DATABASE_URL, and that DATABASE_URL does not
// reference the production project ref, before any test establishes a
// database connection.
// ============================================================================

import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
