import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { CpdVerificationLink } from '@/components/policy/cpd-verification-link'
import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import { REFUND_FULL_DAYS, REFUND_PROCESSING_HOURS, TRANSFER_DEADLINE_DAYS } from '@/lib/policy-terms'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/faq'

export const metadata: Metadata = {
  title: 'FAQ | Edugistics',
  description: 'Answers to common questions about Edugistics training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group border-b border-edu-navy/20 py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-[family-name:var(--font-league-spartan)] font-bold text-lg text-edu-navy marker:text-edu-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal sm:text-xl">
        {question}
        <span aria-hidden="true" className="shrink-0 text-xl transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 text-base leading-relaxed text-edu-navy sm:text-lg">{children}</div>
    </details>
  )
}

export default function FaqPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Frequently Asked Questions</h1>
        <p className="text-sm text-edu-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col sm:mt-12">
        <FaqItem question="1. What does Edugistics do?">
          <p>
            Edugistics is an educational consultancy and school management company dedicated to
            improving teaching, leadership and school performance.
          </p>
        </FaqItem>

        <FaqItem question="2. Who are the courses for?">
          <p>
            Teachers can access professional development courses covering teaching strategies,
            classroom management, curriculum development, assessment, educational technology and
            leadership.
          </p>
        </FaqItem>

        <FaqItem question="3. Are your courses accredited?">
          <p>
            Yes, Edugistics is accredited by The CPD Standards Office. See the{' '}
            <Link href="/policies/certificate" className="underline underline-offset-2">
              Certificate Policy
            </Link>
            . <CpdVerificationLink />.
          </p>
        </FaqItem>

        <FaqItem question="4. How do I register for a course?">
          <p>
            Choose a course and complete the registration form. See the{' '}
            <Link href="/policies/registration" className="underline underline-offset-2">
              Registration Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="5. How do I pay?">
          <p>
            A payment link is sent to you separately after registration. See the{' '}
            <Link href="/policies/payment" className="underline underline-offset-2">
              Payment Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="6. What happens if a course is full?">
          <p>
            You are placed on a waiting list with a position, where a waiting list is open. See the{' '}
            <Link href="/policies/registration" className="underline underline-offset-2">
              Registration Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="7. When will I receive my joining details?">
          <p>
            Your joining instructions are in your confirmation email. See the{' '}
            <Link href="/policies/digital-delivery" className="underline underline-offset-2">
              Digital Delivery Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="8. Are course materials provided?">
          <p>
            Yes, timing depends on delivery mode. See the{' '}
            <Link href="/policies/digital-delivery" className="underline underline-offset-2">
              Digital Delivery Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="9. Are sessions recorded?">
          <p>
            No, sessions are not recorded. See the{' '}
            <Link href="/policies/digital-delivery" className="underline underline-offset-2">
              Digital Delivery Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="10. When do I receive my certificate?">
          <p>
            Timing depends on delivery mode. See the{' '}
            <Link href="/policies/certificate" className="underline underline-offset-2">
              Certificate Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="11. Can I get a refund if I cancel?">
          <p>
            You receive a full refund if you cancel {REFUND_FULL_DAYS} or more days before the
            start date, and approved refunds are processed within {REFUND_PROCESSING_HOURS} hours.
            See the{' '}
            <Link href="/policies/refund-and-cancellation" className="underline underline-offset-2">
              Refund and Cancellation Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="12. Can I change to a different course date?">
          <p>
            You may request a transfer up to {TRANSFER_DEADLINE_DAYS} days before the start date.
            See the{' '}
            <Link href="/policies/course-transfer" className="underline underline-offset-2">
              Course Transfer Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="13. Can I send a colleague in my place?">
          <p>
            Yes, up to {TRANSFER_DEADLINE_DAYS} days before the start date. See the{' '}
            <Link href="/policies/course-transfer" className="underline underline-offset-2">
              Course Transfer Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="14. What happens if Edugistics cancels or reschedules?">
          <p>
            You choose between a full refund and a transfer to the rescheduled date. See the{' '}
            <Link href="/policies/refund-and-cancellation" className="underline underline-offset-2">
              Refund and Cancellation Policy
            </Link>
            .
          </p>
        </FaqItem>

        <FaqItem question="15. How do I contact Edugistics?">
          <p>
            See our{' '}
            <Link href="/contact" className="underline underline-offset-2">
              Contact page
            </Link>{' '}
            for phone, email and WhatsApp details.
          </p>
        </FaqItem>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
