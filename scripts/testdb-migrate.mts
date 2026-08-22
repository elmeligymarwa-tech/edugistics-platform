// Applies pending Prisma migrations (`prisma migrate deploy`) to whatever
// database DATABASE_URL/DIRECT_URL point at. `migrate deploy` only applies
// migrations not yet recorded as applied and never generates a new one, so
// this is safe to run repeatedly.
//
// Run via `npm run testdb:migrate`, which loads .env.test first (see
// package.json) — DATABASE_URL/DIRECT_URL/TEST_DATABASE_URL always come
// from there, never from .env or .env.local.
//
// Refuses to run against anything that isn't a confirmed test database:
// reuses the exact guard the test suite itself uses (DATABASE_URL must not
// be the production project, and TEST_DATABASE_URL must match it exactly).
// See vitest.database-guard.ts and CLAUDE.md, "Test suite writes to the
// production database".
import { spawnSync } from 'node:child_process'

import { checkDatabaseIsSafeForTests } from '../vitest.database-guard.ts'

checkDatabaseIsSafeForTests(process.env)

const result = spawnSync('node_modules/.bin/prisma', ['migrate', 'deploy'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
