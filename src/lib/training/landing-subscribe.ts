import 'server-only'

import { LANDING_PAGE_CONSENT_WORDING_VERSION } from '@/domain/training/consent-wording'
import { normaliseEmail } from './normalise'
import { prisma } from './prisma'
import { generateUnsubscribeToken } from './unsubscribe-token'

export interface LandingSubscribeInput {
  fullName: string
  email: string
  now: Date
}

/**
 * Single opt-in — a submitted address is subscribed immediately, no
 * confirmation email. The caller (the API route) is responsible for the
 * safeguards this compensates for: validation, the honeypot check and rate
 * limiting all happen before this is called.
 *
 * Deduplicates by normalised email, the same key register-for-course.ts's
 * applyRegistrationConsent uses — a person who subscribes here and later
 * registers for a course links to this same row rather than duplicating.
 *
 * - No subscriber yet: create one, SUBSCRIBED, source LANDING_PAGE, a fresh
 *   unsubscribe token, and log a SUBSCRIBED event.
 * - Already SUBSCRIBED: change nothing, log a SUBSCRIBED event recording
 *   the repeat submission. The caller must never reveal this branch was
 *   taken — the response is identical in every case.
 * - Currently UNSUBSCRIBED: this is an explicit opt-in — resubscribe (new
 *   subscribedAt, cleared unsubscribedAt) and log a RESUBSCRIBED event.
 */
export async function subscribeFromLandingPage(input: LandingSubscribeInput): Promise<void> {
  const emailNormalised = normaliseEmail(input.email)
  const existing = await prisma.subscriber.findUnique({ where: { emailNormalised } })

  if (!existing) {
    await prisma.$transaction(async (tx) => {
      const subscriber = await tx.subscriber.create({
        data: {
          teacherId: null,
          emailNormalised,
          fullName: input.fullName,
          emailOriginal: input.email,
          status: 'SUBSCRIBED',
          subscribedAt: input.now,
          consentSource: 'LANDING_PAGE',
          consentWordingVersion: LANDING_PAGE_CONSENT_WORDING_VERSION,
          unsubscribeToken: generateUnsubscribeToken(),
        },
      })
      await tx.consentEvent.create({
        data: {
          subscriberId: subscriber.id,
          eventType: 'SUBSCRIBED',
          source: 'LANDING_PAGE',
          wordingVersion: LANDING_PAGE_CONSENT_WORDING_VERSION,
          occurredAt: input.now,
        },
      })
    })
    return
  }

  if (existing.status === 'SUBSCRIBED') {
    await prisma.consentEvent.create({
      data: {
        subscriberId: existing.id,
        eventType: 'SUBSCRIBED',
        source: 'LANDING_PAGE',
        wordingVersion: LANDING_PAGE_CONSENT_WORDING_VERSION,
        occurredAt: input.now,
      },
    })
    return
  }

  // existing.status === 'UNSUBSCRIBED' — an explicit re-submission is an allowed, explicit opt-in.
  await prisma.$transaction(async (tx) => {
    await tx.subscriber.update({
      where: { id: existing.id },
      data: {
        status: 'SUBSCRIBED',
        subscribedAt: input.now,
        unsubscribedAt: null,
        consentSource: 'LANDING_PAGE',
        consentWordingVersion: LANDING_PAGE_CONSENT_WORDING_VERSION,
      },
    })
    await tx.consentEvent.create({
      data: {
        subscriberId: existing.id,
        eventType: 'RESUBSCRIBED',
        source: 'LANDING_PAGE',
        wordingVersion: LANDING_PAGE_CONSENT_WORDING_VERSION,
        occurredAt: input.now,
      },
    })
  })
}
