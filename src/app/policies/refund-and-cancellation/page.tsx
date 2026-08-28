import type { Metadata } from 'next'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_SECTION_HEADING, POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import {
  CHANGE_REQUEST_EMAIL,
  CHANGE_REQUEST_SUBJECT,
  CREDIT_EXPIRY_MONTHS,
  EDUGISTICS_CANCELLATION_NOTICE_DAYS,
  REFUND_FULL_DAYS,
  REFUND_PROCESSING_HOURS,
  TRANSFER_DEADLINE_DAYS,
} from '@/lib/policy-terms'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/refund-and-cancellation'

export const metadata: Metadata = {
  title: 'Refund and Cancellation Policy | Edugistics',
  description:
    'Refund, cancellation, transfer and substitution terms for Edugistics training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function RefundAndCancellationPolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Refund and Cancellation Policy</h1>
        <p className="text-sm text-edu-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-edu-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>1. Scope</h2>
          <p>
            This policy applies to all paid bookings for Edugistics training courses made through
            www.edugistics.online.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>2. Cancelling your booking</h2>
          <p>
            If you cancel {REFUND_FULL_DAYS} or more days before the published start date of the
            course, you receive a full refund.
          </p>
          <p>
            If you cancel fewer than {REFUND_FULL_DAYS} days before the start date, no refund is
            issued. You may instead transfer your place or nominate a substitute, as set out in
            section 3.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>3. Transfers and substitutions</h2>
          <p>
            Up to {TRANSFER_DEADLINE_DAYS} days before the start date, you may transfer your place
            to any Edugistics course, or nominate a substitute teacher to attend in your place.
          </p>
          <p>
            Send your request by email to{' '}
            <a
              href={`mailto:${CHANGE_REQUEST_EMAIL}`}
              className="underline underline-offset-2"
            >
              {CHANGE_REQUEST_EMAIL}
            </a>{' '}
            with the subject line &ldquo;{CHANGE_REQUEST_SUBJECT}&rdquo;. If nominating a
            substitute, name them in the email.
          </p>
          <p>
            A transfer may be made to any Edugistics course, not only a later run of the same one.
            There is no limit on the number of transfers, and a transferred booking does not
            expire. This is distinct from credit issued on a transfer under section 4, which does
            expire, as set out in section 5.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>4. Price differences on transfer</h2>
          <p>Where the new course costs more, you pay the difference.</p>
          <p>
            Where the new course costs less and the transfer is requested {REFUND_FULL_DAYS} or
            more days before the original start date, the difference is refunded.
          </p>
          <p>
            Where the new course costs less and the transfer is requested inside{' '}
            {REFUND_FULL_DAYS} days of the original start date, the difference is held as credit,
            not refunded in cash.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>5. Credit terms</h2>
          <p>
            Credit expires {CREDIT_EXPIRY_MONTHS} months from the date it is issued. Credit is
            never convertible to cash. Credit stays with the teacher who paid and cannot be passed
            to a colleague.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>6. When the refund right ends</h2>
          <p>
            The refund right attaches to the original booking. Once the original course passes its{' '}
            {REFUND_FULL_DAYS} day mark, the booking stays transferable but carries no refund
            right.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>7. Non-attendance</h2>
          <p>
            Fewer than {TRANSFER_DEADLINE_DAYS} days before the start date, non-attendance is a no
            show. No refund, no transfer and no substitution is available.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>8. Once a course has started</h2>
          <p>
            Once a course has started, no refund is issued, and no partial or pro-rata refund is
            given for sessions missed.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>
            9. Cancellation or postponement by Edugistics
          </h2>
          <p>
            If Edugistics cancels a course for any reason, including low enrolment, you choose
            between a full refund and a transfer to the rescheduled date. Where the cancellation is
            due to low enrolment, at least {EDUGISTICS_CANCELLATION_NOTICE_DAYS} days&rsquo; notice
            is given.
          </p>
          <p>
            If Edugistics reschedules a course, the new date is announced before the original
            start date. If the new date is inconvenient, you may request a full refund at any
            point up to the new start date.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>10. Travel and other costs</h2>
          <p>
            Edugistics is not responsible for travel, accommodation or any other associated costs.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>11. Currency</h2>
          <p>
            Refunds are issued in Egyptian Pounds for the amount paid. Where a card was issued
            outside Egypt, the amount received may differ because of exchange rates applied by the
            issuer. Edugistics does not cover the difference.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>12. Requesting a refund</h2>
          <p>
            Email{' '}
            <a
              href={`mailto:${CHANGE_REQUEST_EMAIL}`}
              className="underline underline-offset-2"
            >
              {CHANGE_REQUEST_EMAIL}
            </a>{' '}
            with your registration reference and the course name. Requests made by phone or
            WhatsApp are acknowledged, then confirmed by email before processing begins.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>13. Processing time</h2>
          <p>
            Approved refunds are processed by Edugistics within {REFUND_PROCESSING_HOURS} hours.
            Bank transfer refunds arrive the same day. Card refunds appear according to the
            issuing bank&rsquo;s own processing times.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>14. Administrative fee</h2>
          <p>Edugistics deducts no administrative fee from an approved refund.</p>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
