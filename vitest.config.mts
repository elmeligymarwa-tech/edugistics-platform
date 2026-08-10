import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

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
    // Sweeps test-marked rows from the shared production database before any
    // test runs and again after every test file has finished — see
    // vitest.global-teardown.ts for why both ends are needed.
    globalSetup: ['./vitest.global-teardown.ts'],
    // The remote Supabase database this project's tests run against adds enough
    // round-trip latency that a multi-query action test can exceed Vitest's 5s default.
    testTimeout: 20000,
  },
})
