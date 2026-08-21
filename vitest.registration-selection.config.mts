import { defineConfig } from 'vitest/config'

// A separate, minimal config for registration-selection.test.ts only.
//
// That file tests a pure, framework-agnostic state machine — no React, no
// Prisma, no database — so it needs neither a real database nor
// vitest.config.mts's setupFiles/aliases/globalSetup. Running it through the
// main config would trigger vitest.database-guard.ts, which aborts the
// whole process because this repo's current DATABASE_URL is production with
// no TEST_DATABASE_URL — exactly as intended for the main suite, but
// unrelated to what this file tests. See vitest.database-guard.config.mts
// for the same reasoning applied to the guard's own tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/domain/training/registration-selection.test.ts'],
  },
})
