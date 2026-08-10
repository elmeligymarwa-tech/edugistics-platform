// Core logic for the one-off legacy-consent migration (Phase A of the
// mailing list feature), separated from the CLI entry point
// (migrate-legacy-consent-to-subscribers.mts) so it can be exercised
// directly by tests against the real database — same split as
// training-analytics-fixture-plan.ts / seed-training-analytics-fixture.mts.
import type { PrismaClient } from '@prisma/client'

import { MIGRATED_CONSENT_WORDING_VERSION } from '../src/domain/training/consent-wording.ts'
import { generateUnsubscribeToken } from '../src/lib/training/unsubscribe-token.ts'
import { FIXTURE_TEACHER_EMAIL_DOMAIN } from './training-analytics-fixture-plan.ts'

export interface LegacyConsentMigrationPreview {
  eligibleTeacherIds: string[]
  wouldCreate: number
  alreadyMigrated: number
  excludedFixtureRecords: number
}

/**
 * scopeToTeacherIds restricts every query to a specific teacher id set. The
 * real CLI run never passes it, so production behaviour is a full scan of
 * every teacher, exactly as specified. Tests pass it so they only ever see
 * the teachers they created themselves — this repo's test suite runs many
 * files concurrently against one shared database, and other suites
 * transiently create real (non-fixture-domain) teachers with
 * marketingConsent true as part of their own setup; without this scope an
 * unrelated test's teacher could be swept into a Subscriber mid-run.
 */
export interface LegacyConsentMigrationScope {
  scopeToTeacherIds?: string[]
}

/** Read-only — never writes anything. Safe to call without --confirm. */
export async function previewLegacyConsentMigration(
  prisma: PrismaClient,
  scope: LegacyConsentMigrationScope = {},
): Promise<LegacyConsentMigrationPreview> {
  const idScope = scope.scopeToTeacherIds ? { id: { in: scope.scopeToTeacherIds } } : {}

  const eligible = await prisma.teacher.findMany({
    where: {
      ...idScope,
      marketingConsent: true,
      subscriber: null,
      NOT: { emailNormalised: { endsWith: `@${FIXTURE_TEACHER_EMAIL_DOMAIN}` } },
    },
    select: { id: true },
  })

  const alreadyMigrated = await prisma.teacher.count({
    where: {
      ...idScope,
      marketingConsent: true,
      subscriber: { isNot: null },
      NOT: { emailNormalised: { endsWith: `@${FIXTURE_TEACHER_EMAIL_DOMAIN}` } },
    },
  })

  const excludedFixtureRecords = await prisma.teacher.count({
    where: { ...idScope, marketingConsent: true, emailNormalised: { endsWith: `@${FIXTURE_TEACHER_EMAIL_DOMAIN}` } },
  })

  return {
    eligibleTeacherIds: eligible.map((teacher) => teacher.id),
    wouldCreate: eligible.length,
    alreadyMigrated,
    excludedFixtureRecords,
  }
}

/**
 * Creates a Subscriber + opening ConsentEvent for every teacher returned by
 * previewLegacyConsentMigration. Idempotent — teachers already carrying a
 * Subscriber row are excluded by the preview query, so re-running this
 * after a partial or repeat run never creates duplicates.
 */
export async function runLegacyConsentMigration(
  prisma: PrismaClient,
  scope: LegacyConsentMigrationScope = {},
): Promise<{ created: number }> {
  const { eligibleTeacherIds } = await previewLegacyConsentMigration(prisma, scope)
  const teachers = await prisma.teacher.findMany({
    where: { id: { in: eligibleTeacherIds } },
    select: { id: true, emailNormalised: true, marketingConsentAt: true, createdAt: true },
  })

  let created = 0
  for (const teacher of teachers) {
    const subscribedAt = teacher.marketingConsentAt ?? teacher.createdAt
    await prisma.$transaction(async (tx) => {
      const subscriber = await tx.subscriber.create({
        data: {
          teacherId: teacher.id,
          emailNormalised: teacher.emailNormalised,
          status: 'SUBSCRIBED',
          subscribedAt,
          consentSource: 'MIGRATED',
          consentWordingVersion: MIGRATED_CONSENT_WORDING_VERSION,
          unsubscribeToken: generateUnsubscribeToken(),
        },
      })
      await tx.consentEvent.create({
        data: {
          subscriberId: subscriber.id,
          eventType: 'SUBSCRIBED',
          source: 'MIGRATED',
          wordingVersion: MIGRATED_CONSENT_WORDING_VERSION,
          occurredAt: subscribedAt,
        },
      })
    })
    created += 1
  }

  return { created }
}
