// ============================================================================
// WARNING: the training-app test suite writes to the PRODUCTION database.
//
// There is no separate test/dev database — DATABASE_URL (loaded
// automatically by @prisma/client from .env the moment any test imports
// src/lib/training/prisma.ts) is the same Supabase project the live
// edugistics.online/training site reads from. This was a deliberate
// decision (see the feature/mailing-list branch history), not an oversight.
//
// Practical consequences:
//   - Every prisma.*.create/createMany call in a *.test.ts file writes a
//     real row into the live database, however briefly.
//   - Most test files clean up their own rows in afterAll, but that cleanup
//     only runs if the process exits normally. Ctrl+C, a crashed worker, a
//     lost connection to the remote pooler, or a killed terminal all skip
//     afterAll — any rows already created stay in the live database.
//   - src/lib/training/analytics.test.ts seeds six courses with
//     isActive:true, archivedAt:null — the exact conditions the public
//     /training page uses to decide what to show a visitor. If that test's
//     afterAll doesn't run to completion, those courses are publicly
//     visible on the live site until someone deletes them by hand.
//
// DO NOT run this suite (`npm test` / `vitest run`) while teachers or the
// public can reach edugistics.online/training. Run it only when you can
// personally verify the site immediately afterwards, and never leave a run
// unattended or interrupt it partway through.
// ============================================================================

import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
