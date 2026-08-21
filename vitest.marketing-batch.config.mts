import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// A separate, minimal config for send-marketing-campaign.test.ts only.
//
// That file tests mapBatchResponseToOutcomes — a pure function with no
// Prisma, Resend client, or database access — so it needs neither a real
// database nor most of vitest.config.mts's setup. It also has no
// `globalSetup`: running it through the main config would trigger
// vitest.database-guard.ts, which aborts the whole process because this
// repo's current DATABASE_URL is production with no TEST_DATABASE_URL —
// exactly as intended for the main suite, but unrelated to what this file
// tests. See vitest.database-guard.config.mts for the same reasoning
// applied to the guard's own tests.
//
// The `server-only` alias is still needed: send-marketing-campaign.ts
// imports it at module scope (as every server-side training-app module
// does), and its real implementation throws unconditionally outside a
// Next.js server build — see vitest.stubs/server-only.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      'server-only': path.resolve(dirname, './vitest.stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/training/email/send-marketing-campaign.test.ts'],
  },
})
