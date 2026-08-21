import { defineConfig } from 'vitest/config'

// A separate, minimal config for vitest.database-guard.test.ts only.
//
// That test file calls checkDatabaseIsSafeForTests() directly with
// fabricated env objects, so it needs neither a real database nor
// vitest.config.mts's setupFiles/aliases. Crucially, it also has no
// `globalSetup`: wiring the real guard in as globalSetup here would make
// running this file depend on process.env already pointing at a
// locally-configured, correctly-marked test database — which defeats the
// purpose of testing the guard in isolation, and would make this command
// abort before its own tests could load whenever DATABASE_URL isn't set up
// yet (the common case while nothing else needs a database at all).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['vitest.database-guard.test.ts'],
  },
})
