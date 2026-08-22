// One-off migration (Phase A of the mailing list feature): creates a
// Subscriber row — plus its opening ConsentEvent — for every existing
// Teacher whose legacy marketingConsent flag is true. Never touches
// Teacher.marketingConsent itself; see the LEGACY note on that column in
// prisma/schema.prisma. Core logic lives in migrate-legacy-consent-plan.ts
// so it can be tested directly; this file is just the CLI entry point.
//
// Always reports the count it WOULD migrate. Requires --confirm to
// actually write anything.
//
// Deliberately has no default env file wired up in package.json: this is a
// one-off migration against the real Teacher/Subscriber data, i.e.
// production, and must never run by accident against whatever DATABASE_URL
// happens to be lying around. Invoke it directly with an explicit env file,
// e.g. `node --env-file=.env.production.backup scripts/migrate-legacy-consent-to-subscribers.mts --confirm`
// — `npm run migrate:legacy-consent` alone will fail with a missing
// DATABASE_URL, which is the point.
import { PrismaClient } from '@prisma/client'

import { previewLegacyConsentMigration, runLegacyConsentMigration } from './migrate-legacy-consent-plan.ts'

const prisma = new PrismaClient()

async function main() {
  const preview = await previewLegacyConsentMigration(prisma)
  console.log(
    JSON.stringify(
      {
        wouldCreate: preview.wouldCreate,
        alreadyMigrated: preview.alreadyMigrated,
        excludedFixtureRecords: preview.excludedFixtureRecords,
      },
      null,
      2,
    ),
  )

  if (!process.argv.includes('--confirm')) {
    console.error(
      '\nRefusing to write: pass --confirm to create these Subscriber rows.\n' +
        'Example: npm run migrate:legacy-consent -- --confirm',
    )
    process.exitCode = 1
    return
  }

  const { created } = await runLegacyConsentMigration(prisma)
  console.log(JSON.stringify({ created }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
