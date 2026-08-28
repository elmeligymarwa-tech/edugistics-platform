import type { Metadata } from 'next'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { POLICY_SECTION_HEADING, POLICY_TITLE } from '@/components/policy/policy-typography'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import { CHANGE_REQUEST_EMAIL } from '@/lib/policy-terms'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/contact'

export const metadata: Metadata = {
  title: 'Contact Us | Edugistics',
  description: 'How to reach Edugistics by phone, email or WhatsApp.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

export default function ContactPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className={POLICY_TITLE}>Contact Us</h1>
        <p className="text-base text-edu-navy sm:text-lg">Educational Management and Consultancy</p>
      </div>

      <div className="mt-10 flex flex-col gap-8 text-base leading-relaxed text-edu-navy sm:mt-12 sm:gap-10 sm:text-lg sm:leading-loose">
        <section className="flex flex-col gap-1">
          <h2 className={POLICY_SECTION_HEADING}>Address</h2>
          <p>Building 5, Zizina Gardens, New Cairo, Cairo, Egypt</p>
        </section>

        <section className="flex flex-col gap-1">
          <h2 className={POLICY_SECTION_HEADING}>Phone</h2>
          <p>
            <a href="tel:01040400015" className="underline underline-offset-2">
              01040400015
            </a>
          </p>
          <p>
            <a href="tel:01040400016" className="underline underline-offset-2">
              01040400016
            </a>
          </p>
        </section>

        <section className="flex flex-col gap-1">
          <h2 className={POLICY_SECTION_HEADING}>Email</h2>
          <p>
            <a href={`mailto:${CHANGE_REQUEST_EMAIL}`} className="underline underline-offset-2">
              {CHANGE_REQUEST_EMAIL}
            </a>
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={POLICY_SECTION_HEADING}>WhatsApp</h2>
          <a
            href="https://wa.me/201040400015"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center justify-center rounded-full bg-edu-navy px-6 py-3 text-base font-medium text-white sm:text-lg"
          >
            Chat on WhatsApp
          </a>
        </section>
      </div>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
