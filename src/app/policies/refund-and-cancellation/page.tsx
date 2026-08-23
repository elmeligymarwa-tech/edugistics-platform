import type { Metadata } from 'next'

import { PolicyLayout } from '@/components/policy/policy-layout'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/refund-and-cancellation'

export const metadata: Metadata = {
  title: 'Refund and Cancellation Policy | Edugistics',
  description:
    'Refund, cancellation, transfer and substitution terms for Edugistics training courses and webinars.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function RefundAndCancellationPolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl text-brand-navy">Refund and Cancellation Policy</h1>
        <p className="text-sm text-brand-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-brand-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">1. Scope</h2>
          <p>
            This policy applies to all paid bookings for Edugistics training courses, workshops and webinars made
            through www.edugistics.online.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">2. Cancelling your booking</h2>
          <p>
            If you cancel 7 or more days before the published start date and time of the first session, you receive
            a full refund.
          </p>
          <p>
            If you cancel fewer than 7 days before the start, no refund is issued. You may instead transfer your
            place or send a colleague, as set out in section 3.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">3. Transfers and substitutions</h2>
          <p>
            You may transfer your place to a later scheduled run of the same course. One transfer per booking,
            subject to availability. Request the transfer at least 48 hours before the original start time. A
            transferred booking is not refundable.
          </p>
          <p>
            You may send a colleague in your place at no extra charge. Send us their name and email address at least
            24 hours before the start time.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">4. Non-attendance</h2>
          <p>No refund is issued where a delegate does not attend and gave no prior notice.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">5. Multi-day courses</h2>
          <p>Once a course has started, no partial or pro-rata refund is issued for sessions missed.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">6. Cancellation or postponement by Edugistics</h2>
          <p>
            If Edugistics cancels or postpones a course, you choose between a full refund and a transfer to the
            rescheduled date. Edugistics is not responsible for travel, accommodation or any other associated costs.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">7. Recorded and downloadable materials</h2>
          <p>
            Where a booking includes recorded sessions or downloadable resources, the right to a refund ends once
            those materials have been accessed or downloaded.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">8. Requesting a refund</h2>
          <p>
            Email{' '}
            <a href="mailto:Info@edugistics.online" className="underline underline-offset-2">
              Info@edugistics.online
            </a>{' '}
            with your registration reference and the course name. Requests made by phone or WhatsApp are
            acknowledged, then confirmed by email before processing begins.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">9. Processing time</h2>
          <p>
            Approved refunds are returned to the original payment method within 14 working days of approval. Your
            bank or card issuer may take further time before the funds appear on your statement.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">10. Currency</h2>
          <p>
            Refunds are issued in Egyptian Pounds for the amount paid. Where a card was issued outside Egypt, the
            amount received may differ because of exchange rates applied by the issuer. Edugistics does not cover
            the difference.
          </p>
        </section>
      </div>
    </PolicyLayout>
  )
}
