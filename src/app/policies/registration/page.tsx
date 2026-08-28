import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_SECTION_HEADING, POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/registration'

export const metadata: Metadata = {
  title: 'Registration Policy | Edugistics',
  description: 'How registration works for Edugistics training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function RegistrationPolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Registration Policy</h1>
        <p className="text-sm text-edu-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-edu-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>1. How to register</h2>
          <p>
            Choose a course from those listed on www.edugistics.online and complete the
            registration form for it.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>2. Information you supply</h2>
          <p>
            The form asks for your full name, email address, phone number, school name, the
            subject and year group you teach, and an optional address. You choose whether to
            receive marketing communications, and you may enter a promo code if you have one.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>3. How your place is confirmed</h2>
          <p>
            Your place is confirmed on availability, not on payment. Payment instructions follow
            separately after registration. See the{' '}
            <Link href="/policies/payment" className="underline underline-offset-2">
              Payment Policy
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>4. Confirmation email</h2>
          <p>
            You receive a confirmation email with a registration reference. Keep this reference,
            as it is used to identify your booking in any later correspondence.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>5. Waiting lists</h2>
          <p>
            Where a course is full and a waiting list is open, registering places you on the
            waiting list with a position, rather than confirming your place.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>6. After you register</h2>
          <p>
            For what you receive after registering, and how the course is delivered, see the{' '}
            <Link href="/policies/digital-delivery" className="underline underline-offset-2">
              Digital Delivery Policy
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>7. Certificate eligibility</h2>
          <p>
            For certificate eligibility and issue timing, see the{' '}
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
