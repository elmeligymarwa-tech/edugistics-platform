import 'server-only'

import type { Prisma } from '@prisma/client'

import { CURRENT_CONSENT_WORDING_VERSION } from '@/domain/training/consent-wording'
import { generateUnsubscribeToken } from './unsubscribe-token'
import type { prisma } from './prisma'

type SubscribersDbClient = typeof prisma | Prisma.TransactionClient

export interface ApplyRegistrationConsentInput {
  teacherId: string
  emailNormalised: string
  courseId: string
  /** The registration form's marketing consent checkbox, as submitted. */
  marketingConsentTicked: boolean
  now: Date
  /** Registration.sourceIpHash's twin — same one-way digest, reused so a single registration only ever hashes the submitter's IP once. */
  ipHash: string | null
}

/**
 * Applies the subscription rules from the mailing list spec inside the
 * caller's registration transaction, after the Teacher row has been
 * resolved. Deduplicates by teacherId (Teacher is already deduplicated by
 * emailNormalised, so this is equivalent to deduplicating by normalised
 * email). Never called outside registerForCourse's transaction in this
 * phase — Subscriber.status is the sole authority on marketing-email
 * eligibility; see the LEGACY note on Teacher.marketingConsent.
 *
 * - Ticked, no subscriber yet: create one, SUBSCRIBED, and log a SUBSCRIBED event.
 * - Ticked, already SUBSCRIBED: leave status and subscribedAt alone, refresh
 *   the course/wording it was last reaffirmed with, and log a SUBSCRIBED event.
 * - Ticked, currently UNSUBSCRIBED: this is an explicit opt-in — resubscribe
 *   (new subscribedAt, cleared unsubscribedAt) and log a RESUBSCRIBED event.
 * - Not ticked: never creates, never resubscribes, never unsubscribes. An
 *   unticked box on a later registration is not a withdrawal of consent.
 */
export async function applyRegistrationConsent(db: SubscribersDbClient, input: ApplyRegistrationConsentInput): Promise<void> {
  if (!input.marketingConsentTicked) return

  const existing = await db.subscriber.findUnique({ where: { teacherId: input.teacherId } })

  if (!existing) {
    const subscriber = await db.subscriber.create({
      data: {
        teacherId: input.teacherId,
        emailNormalised: input.emailNormalised,
        status: 'SUBSCRIBED',
        subscribedAt: input.now,
        consentSource: 'TRAINING_REGISTRATION',
        consentCourseId: input.courseId,
        consentWordingVersion: CURRENT_CONSENT_WORDING_VERSION,
        unsubscribeToken: generateUnsubscribeToken(),
      },
    })
    await db.consentEvent.create({
      data: {
        subscriberId: subscriber.id,
        eventType: 'SUBSCRIBED',
        source: 'TRAINING_REGISTRATION',
        courseId: input.courseId,
        wordingVersion: CURRENT_CONSENT_WORDING_VERSION,
        ipHash: input.ipHash,
        occurredAt: input.now,
      },
    })
    return
  }

  if (existing.status === 'SUBSCRIBED') {
    await db.subscriber.update({
      where: { id: existing.id },
      data: {
        consentCourseId: input.courseId,
        consentWordingVersion: CURRENT_CONSENT_WORDING_VERSION,
      },
    })
    await db.consentEvent.create({
      data: {
        subscriberId: existing.id,
        eventType: 'SUBSCRIBED',
        source: 'TRAINING_REGISTRATION',
        courseId: input.courseId,
        wordingVersion: CURRENT_CONSENT_WORDING_VERSION,
        ipHash: input.ipHash,
        occurredAt: input.now,
      },
    })
    return
  }

  // existing.status === 'UNSUBSCRIBED' — an explicit re-tick is an allowed, explicit opt-in.
  await db.subscriber.update({
    where: { id: existing.id },
    data: {
      status: 'SUBSCRIBED',
      subscribedAt: input.now,
      unsubscribedAt: null,
      consentSource: 'TRAINING_REGISTRATION',
      consentCourseId: input.courseId,
      consentWordingVersion: CURRENT_CONSENT_WORDING_VERSION,
    },
  })
  await db.consentEvent.create({
    data: {
      subscriberId: existing.id,
      eventType: 'RESUBSCRIBED',
      source: 'TRAINING_REGISTRATION',
      courseId: input.courseId,
      wordingVersion: CURRENT_CONSENT_WORDING_VERSION,
      ipHash: input.ipHash,
      occurredAt: input.now,
    },
  })
}
