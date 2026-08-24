import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import { MINIMUM_ATTENDANCE_PERCENT, TRANSFER_DEADLINE_DAYS } from '@/lib/policy-terms'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/attendance'

export const metadata: Metadata = {
  title: 'Attendance Policy | Edugistics',
  description: 'Attendance requirements for Edugistics training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function AttendancePolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl text-brand-navy">Attendance Policy</h1>
        <p className="text-sm text-brand-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-brand-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">1. Non-attendance</h2>
          <p>
            A transfer or substitution request must be made at least {TRANSFER_DEADLINE_DAYS} days
            before the start date. Non-attendance where no such request was made is a no show. No
            refund is issued. See the{' '}
            <Link href="/policies/refund-and-cancellation" className="underline underline-offset-2">
              Refund and Cancellation Policy
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">2. CPD credit hours</h2>
          <p>
            CPD certificates record the credit hours you actually attended. For certificate
            issuing, see the{' '}
            <Link href="/policies/certificate" className="underline underline-offset-2">
              Certificate Policy
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">3. Minimum attendance</h2>
          <p>
            Minimum attendance is {MINIMUM_ATTENDANCE_PERCENT} percent of scheduled course hours.
            Attended hours are recorded as actually attended, so late arrival or early departure
            reduces them. A certificate is issued only where total attendance reaches{' '}
            {MINIMUM_ATTENDANCE_PERCENT} percent. Where it does not, no certificate is issued and
            no refund is due.
          </p>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
