import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/digital-delivery'

export const metadata: Metadata = {
  title: 'Digital Delivery Policy | Edugistics',
  description: 'How joining instructions, materials and course delivery work at Edugistics.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function DigitalDeliveryPolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl text-brand-navy">Digital Delivery Policy</h1>
        <p className="text-sm text-brand-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-brand-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">1. Scope</h2>
          <p>
            This policy explains what you receive after registering for an Edugistics training
            course, and how that course is delivered.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">2. Confirmation email</h2>
          <p>
            On registration you receive a confirmation email containing your registration
            reference, the course name, the date and the time.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">3. Joining instructions</h2>
          <p>
            The confirmation email carries the joining instructions for the course. For an online
            course this is the online joining link. For an in person course this is the venue
            details.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">4. Course materials</h2>
          <p>
            For an online course, materials are sent after the course begins. For an in person
            course, materials are handed out during the session.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">5. Recording</h2>
          <p>No session is recorded. No recordings or replays are provided.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">6. Certificates</h2>
          <p>
            For certificate timing, see the{' '}
            <Link href="/policies/certificate" className="underline underline-offset-2">
              Certificate Policy
            </Link>
            .
          </p>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
