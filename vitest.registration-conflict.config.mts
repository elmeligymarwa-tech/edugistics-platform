import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// A separate, minimal config for register-for-course-conflict.test.ts only
// (defect 6). That file tests two pure helpers — no Prisma client
// instantiation, no database access — imported from register-for-course.ts,
// which the real registration flow also uses for its actual database work.
// Importing that module still triggers its top-level `import 'server-only'`,
// hence the alias below, but nothing in these tests ever opens a database
// connection. Deliberately has no `globalSetup`: routing this through the
// main config would trigger vitest.database-guard.ts, which aborts the
// whole process because this repo's current DATABASE_URL is production
// with no TEST_DATABASE_URL — exactly as intended for the main suite, but
// unrelated to what this file tests. See vitest.database-guard.config.mts
// for the same reasoning applied to the guard's own tests.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      'server-only': path.resolve(dirname, './vitest.stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/training/register-for-course-conflict.test.ts'],
  },
})
