import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  CERTIFICATE_DIGITAL_DAYS,
  CPD_ACCREDITATION_PERIOD,
  CPD_PROVIDER_NUMBER,
  MINIMUM_ATTENDANCE_PERCENT,
  REFUND_FULL_DAYS,
  REFUND_PROCESSING_HOURS,
  TRANSFER_DEADLINE_DAYS,
} from '@/lib/policy-terms'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

function FaqItem({
  question,
  href,
  linkLabel,
  children,
}: {
  question: string
  href: string
  linkLabel: string
  children: ReactNode
}) {
  return (
    <details className="group border-b border-edu-navy/15 py-5">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-edu-navy marker:text-edu-teal ${FOCUS_RING}`}
      >
        {question}
        <span aria-hidden="true" className="shrink-0 text-xl text-edu-teal transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 max-w-[52ch] text-base leading-relaxed text-edu-navy/80">
        <p className="mb-2">{children}</p>
        <Link
          href={href}
          className={`inline-flex min-h-11 items-center gap-1.5 font-bold text-edu-navy hover:text-edu-teal ${FOCUS_RING}`}
        >
          Read the {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </details>
  )
}

export function FaqPreview() {
  return (
    <section id="faqs" className="border-t border-edu-navy/10 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
          <h2 className={`${HEADING_FONT} text-[clamp(1.9rem,3.6vw,2.9rem)] tracking-tight text-edu-navy`}>
            Frequently Asked Questions
          </h2>
          <Link
            href="#contact"
            className={`inline-flex min-h-11 items-center gap-2 font-bold text-edu-navy hover:text-edu-teal ${FOCUS_RING}`}
          >
            Still have a question? <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="border-t border-edu-navy/15">
          <FaqItem question="Who can register?" href="/policies/registration" linkLabel="Registration Policy">
            Individual teachers and educators can register directly for available courses. Your
            place is confirmed on availability, not on payment.
          </FaqItem>

          <FaqItem question="How do I register?" href="/policies/registration" linkLabel="Registration Policy">
            Choose a course and complete the registration form. You receive a confirmation email
            with a registration reference.
          </FaqItem>

          <FaqItem question="How do I pay?" href="/policies/payment" linkLabel="Payment Policy">
            Payment is not collected through the registration form. A payment link is sent
            separately to the phone number you give at registration, using InstaPay. Fees are
            payable in Egyptian Pounds.
          </FaqItem>

          <FaqItem
            question="When will I receive my joining details?"
            href="/policies/digital-delivery"
            linkLabel="Digital Delivery Policy"
          >
            Your joining instructions are in your confirmation email — the online link for an
            online course, or the venue details for an in person course.
          </FaqItem>

          <FaqItem question="Are the courses accredited?" href="/policies/certificate" linkLabel="Certificate Policy">
            Yes. Edugistics Ltd is an accredited provider with The CPD Standards Office, CPD
            Provider number {CPD_PROVIDER_NUMBER}, accreditation period {CPD_ACCREDITATION_PERIOD}.
          </FaqItem>

          <FaqItem
            question="When do I receive my certificate?"
            href="/policies/certificate"
            linkLabel="Certificate Policy"
          >
            You receive a link to view your certificate online. For an online course it is issued
            within {CERTIFICATE_DIGITAL_DAYS} days of the course ending; for an in person course a
            paper certificate is given on the final day. Minimum attendance is{' '}
            {MINIMUM_ATTENDANCE_PERCENT} percent.
          </FaqItem>

          <FaqItem
            question="Can I get a refund if I cancel?"
            href="/policies/refund-and-cancellation"
            linkLabel="Refund and Cancellation Policy"
          >
            You receive a full refund if you cancel {REFUND_FULL_DAYS} or more days before the
            start date. Approved refunds are processed within {REFUND_PROCESSING_HOURS} hours, with
            no administrative fee.
          </FaqItem>

          <FaqItem
            question="Can I change dates or send a colleague?"
            href="/policies/course-transfer"
            linkLabel="Course Transfer Policy"
          >
            You may transfer your place to any Edugistics course, or nominate a substitute to
            attend instead, up to {TRANSFER_DEADLINE_DAYS} days before the start date.
          </FaqItem>
        </div>

        <Link
          href="/faq"
          className={`mt-8 inline-flex min-h-11 items-center gap-2 font-bold text-edu-navy hover:text-edu-teal ${FOCUS_RING}`}
        >
          View all FAQs <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
