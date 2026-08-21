import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// A separate config for the two test files touched by defect 3
// (rich-text.test.ts, send-email-composer.test.tsx) — both verified DB-free:
// rich-text.ts is a pure string renderer, and send-email-composer.test.tsx
// mocks every server action it imports (see its own vi.mock calls), so
// nothing in it ever reaches Prisma. Otherwise mirrors vitest.config.mts
// (react plugin, aliases, setupFiles for jsdom/jest-dom) but deliberately
// has no `globalSetup`: routing these two files through the main config
// would trigger vitest.database-guard.ts, which correctly aborts the whole
// process because this repo's current DATABASE_URL is production with no
// TEST_DATABASE_URL — exactly as intended for the main suite, but unrelated
// to what these two files test.
//
// Deliberately NOT a broad include glob: this file only ever runs the two
// specific files listed below, so it can never become an accidental way to
// run a DB-touching test outside the guard. See vitest.database-guard.config.mts,
// vitest.batch-send.config.mts and vitest.registration-selection.config.mts
// for the same narrow pattern applied to earlier defects.
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
    include: [
      'src/lib/training/email/rich-text.test.ts',
      'src/components/training/admin/send-email-composer.test.tsx',
    ],
  },
})
