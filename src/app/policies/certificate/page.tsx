import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_SECTION_HEADING, POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import { CERTIFICATE_DIGITAL_DAYS, CPD_ACCREDITATION_PERIOD, CPD_PROVIDER_NUMBER } from '@/lib/policy-terms'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies/certificate'

export const metadata: Metadata = {
  title: 'Certificate Policy | Edugistics',
  description: 'CPD accreditation and certificate issuing for Edugistics training courses.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function CertificatePolicyPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Certificate Policy</h1>
        <p className="text-sm text-edu-navy">Last updated: August 2026</p>
      </div>

      <div className="mt-10 flex flex-col gap-10 text-base leading-relaxed text-edu-navy sm:mt-12 sm:gap-12 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>1. Accreditation</h2>
          <p>
            Edugistics Ltd is an accredited provider with The CPD Standards Office, CPD Provider
            number {CPD_PROVIDER_NUMBER}, accreditation period {CPD_ACCREDITATION_PERIOD}. All
            Edugistics courses are registered with The CPD Standards Office by prior arrangement.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>2. What the certificate records</h2>
          <p>Certificates record the CPD credit hours attended.</p>
          <p>
            A certificate is issued only where attendance reaches the minimum set out in the{' '}
            <Link href="/policies/attendance" className="underline underline-offset-2">
              Attendance Policy
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>3. Receiving your certificate</h2>
          <p>You receive a link to view your certificate online.</p>
          <p>
            For an online course, the certificate is issued within {CERTIFICATE_DIGITAL_DAYS} days
            of the course ending.
          </p>
          <p>
            For an in person course, a paper certificate is given on the final day, and the
            digital certificate follows within {CERTIFICATE_DIGITAL_DAYS} days.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>4. Substitutes</h2>
          <p>
            Where a substitute attends in place of the registered teacher, the certificate is
            issued in the name of the person who attended.
          </p>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
