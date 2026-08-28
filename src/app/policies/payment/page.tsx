import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_SECTION_HEADING, POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/payment'

export const metadata: Metadata = {
  title: 'Payment Policy | Edugistics',
  description: 'How fees are collected for Edugistics training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function PaymentPolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Payment Policy</h1>
        <p className="text-sm text-edu-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-edu-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>1. Scope</h2>
          <p>
            This policy applies to fees for all Edugistics training courses booked through
            www.edugistics.online.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>2. Currency</h2>
          <p>All fees are payable in Egyptian Pounds.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>3. How payment works</h2>
          <p>
            Payment is not collected through the registration system. Your place is confirmed on
            availability, and payment instructions are sent to you separately after registration.
          </p>
          <p>
            Payment is collected by a payment link sent to the phone number you give at
            registration, using InstaPay.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>4. Refunds</h2>
          <p>
            For refund, cancellation, transfer and substitution terms, see the{' '}
            <Link href="/policies/refund-and-cancellation" className="underline underline-offset-2">
              Refund and Cancellation Policy
            </Link>
            .
          </p>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
