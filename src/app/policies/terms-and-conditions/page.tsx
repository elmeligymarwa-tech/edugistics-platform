import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_SECTION_HEADING, POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/terms-and-conditions'

export const metadata: Metadata = {
  title: 'Terms and Conditions | Edugistics',
  description: 'The terms and conditions governing bookings for Edugistics training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function TermsAndConditionsPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Terms and Conditions</h1>
        <p className="text-sm text-edu-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-edu-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>1. The operator</h2>
          <p>
            www.edugistics.online is operated by Edugistics Ltd, trading as Edugistics. These
            terms govern every booking made through the site.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>2. Eligibility</h2>
          <p>
            Registration is intended for practising teachers and school staff registering on their
            own behalf or on behalf of a colleague they are authorised to register.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>3. Accuracy of information</h2>
          <p>
            You are responsible for the accuracy of the information you supply at registration,
            including your contact details and school information. Edugistics relies on this
            information to confirm your place and to send joining instructions.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>4. Conduct during training</h2>
          <p>
            You are expected to engage respectfully with trainers and other attendees, and to
            follow any reasonable instruction given by Edugistics staff during a course.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>5. Intellectual property</h2>
          <p>
            Course materials are provided for the registered attendee&rsquo;s own professional use
            only. They may not be shared, copied, reproduced, recorded or distributed.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>6. Limitation of liability</h2>
          <p>
            Edugistics is not liable for any indirect or consequential loss arising from your
            booking, attendance or non-attendance at a course, beyond the fees you have paid for
            that course.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>7. Cancellations and refunds</h2>
          <p>
            For cancellation, transfer, substitution and refund terms, see the{' '}
            <Link href="/policies/refund-and-cancellation" className="underline underline-offset-2">
              Refund and Cancellation Policy
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>8. Changes to these terms</h2>
          <p>
            Edugistics may update these terms from time to time. The version published on this
            page at the time of your booking applies to that booking.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>9. Governing law</h2>
          <p>These terms are governed by the laws of the Arab Republic of Egypt.</p>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
