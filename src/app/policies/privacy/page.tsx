import type { Metadata } from 'next'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_SECTION_HEADING, POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import { CHANGE_REQUEST_EMAIL, DATA_DELETION_DAYS } from '@/lib/policy-terms'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/privacy'

export const metadata: Metadata = {
  title: 'Privacy Policy | Edugistics',
  description: 'How Edugistics collects, uses and protects information from teachers registering for training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Privacy Policy</h1>
        <p className="text-sm text-edu-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-edu-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>1. What we collect</h2>
          <p>
            When you register for a course, our registration form asks for your full name, email
            address, phone number, school name, the subject you teach, the year group you teach,
            an optional address, and a choice about whether you would like to receive marketing
            communications.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>2. Why we collect it</h2>
          <p>
            Your name, email, phone number and school details are used to confirm your booking,
            send your joining instructions and certificate, and contact you about the course you
            registered for. Your subject and year group are collected to understand your
            professional teaching context and to identify courses and training opportunities that
            may be relevant to you.
          </p>
          <p>
            The registration form currently includes an optional address field. Providing an
            address is not required to register for a course. The address is not used for
            marketing, course targeting or profiling.
          </p>
          <p>Your marketing choice controls whether we contact you about future courses.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>3. Marketing communications</h2>
          <p>
            We send information about available courses only where you have given marketing
            consent. This consent defaults to off and is never assumed. Every marketing email
            includes an option to unsubscribe.
          </p>
          <p>
            Where a teacher has given marketing consent, their subject and year group may be used
            to select which course announcements they receive. A teacher who has declined
            marketing communications is never selected for targeted course announcements on the
            basis of subject, year group or any other profile information.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>4. How long we keep your information</h2>
          <p>
            Records are retained indefinitely unless a teacher requests deletion. Edugistics is
            reviewing its retention periods.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>5. Deletion</h2>
          <p>
            To request deletion of your information, write to{' '}
            <a href={`mailto:${CHANGE_REQUEST_EMAIL}`} className="underline underline-offset-2">
              {CHANGE_REQUEST_EMAIL}
            </a>
            . Deletion requests are handled manually and are actioned within {DATA_DELETION_DAYS}{' '}
            days of a written request.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>6. Sharing your information</h2>
          <p>
            We share your information with the service providers who help us run our registration,
            email and course delivery systems, only as needed to provide those services.
          </p>
          <p>
            Separately, advertising and analytics providers, including Meta, receive limited data
            about site activity and registrations.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>7. Cookies and analytics</h2>
          <p>
            Our site uses cookies and third party analytics and advertising tools, including Meta,
            to understand how the site is used and to measure our marketing. A consent mechanism
            for these tools is being introduced.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>8. Contact</h2>
          <p>
            For any question about this policy or your information, write to{' '}
            <a href={`mailto:${CHANGE_REQUEST_EMAIL}`} className="underline underline-offset-2">
              {CHANGE_REQUEST_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
