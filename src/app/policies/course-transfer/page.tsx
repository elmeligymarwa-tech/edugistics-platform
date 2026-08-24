import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import { CHANGE_REQUEST_EMAIL, CHANGE_REQUEST_SUBJECT, TRANSFER_DEADLINE_DAYS } from '@/lib/policy-terms'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/course-transfer'

export const metadata: Metadata = {
  title: 'Course Transfer Policy | Edugistics',
  description: 'How to transfer your place to a different Edugistics training course.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function CourseTransferPolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl text-brand-navy">Course Transfer Policy</h1>
        <p className="text-sm text-brand-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-brand-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">1. Scope</h2>
          <p>
            This policy explains how to transfer your booking to a different Edugistics training
            course.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">2. Deadline</h2>
          <p>
            You may request a transfer up to {TRANSFER_DEADLINE_DAYS} days before the original
            start date.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">3. How to request a transfer</h2>
          <p>
            Email{' '}
            <a href={`mailto:${CHANGE_REQUEST_EMAIL}`} className="underline underline-offset-2">
              {CHANGE_REQUEST_EMAIL}
            </a>{' '}
            with the subject line &ldquo;{CHANGE_REQUEST_SUBJECT}&rdquo;, your registration
            reference and the course you wish to transfer to.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl sm:text-2xl">4. Price differences and credit</h2>
          <p>
            For how a price difference between courses is handled, how credit is issued and when
            it expires, and the effect a transfer has on your refund rights, see the{' '}
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
