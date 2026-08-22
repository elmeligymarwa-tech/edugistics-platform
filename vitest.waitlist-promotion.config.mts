import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// A separate config for promote-registration-dialog.test.ts only (defect 4).
//
// That file mocks promoteRegistrationAction and next/navigation entirely
// (see its own vi.mock calls), so it never reaches Prisma — DB-free.
// promoteRegistrationAction's own integration test
// (courses/[id]/waitlist/actions.test.ts) genuinely does hit the real
// database (row-locked capacity checks and waitlist-position resequencing
// have no mockable boundary from Postgres — see that file's own comment)
// and runs through the default suite instead (npm run testdb:run), same as
// every other *.test.ts file — it needs the real guard/sweep in
// vitest.config.mts's globalSetup, unlike this file's DB-free component
// test. It could not run at all until this repo had a dedicated test
// database (see TEST-DATABASE.md); before that, DATABASE_URL was production
// with no TEST_DATABASE_URL, and vitest.database-guard.ts correctly refused
// to run anything against it.
//
// Otherwise mirrors vitest.config.mts (react plugin, aliases, setupFiles for
// jsdom/jest-dom) but deliberately has no `globalSetup`. See
// vitest.campaign-composer.config.mts for the same narrow pattern.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      'server-only': path.resolve(dirname, './vitest.stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/components/training/admin/promote-registration-dialog.test.tsx'],
  },
})
