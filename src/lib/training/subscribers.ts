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
 * resolved. Looks up any existing subscriber by normalised email — the one
 * key that spans both a teacher-linked subscriber and a landing page
 * subscriber (Phase C) who has no teacher yet. Never called outside
 * registerForCourse's transaction in this phase — Subscriber.status is the
 * sole authority on marketing-email eligibility; see the LEGACY note on
 * Teacher.marketingConsent.
 *
 * Linking happens unconditionally, before the consent-ticked check: if this
 * email already has a landing page subscriber (teacherId null), it is
 * linked to the teacher just resolved by this registration, regardless of
 * whether the checkbox is ticked here — an unticked box is not a withdrawal
 * of consent, so it must not sever an already-valid landing page
 * subscription from the teacher record it belongs to. Their subscribedAt
 * and consent history are preserved; no second subscriber is ever created.
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
  const found = await db.subscriber.findUnique({ where: { emailNormalised: input.emailNormalised } })

  const existing =
    found && found.teacherId === null
      ? await db.subscriber.update({ where: { id: found.id }, data: { teacherId: input.teacherId } })
      : found

  if (!input.marketingConsentTicked) return

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
