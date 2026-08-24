import type { Metadata } from 'next'
import Link from 'next/link'

import { PolicyLayout } from '@/components/policy/policy-layout'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/policies'

export const metadata: Metadata = {
  title: 'Policies | Edugistics',
  description: 'All Edugistics policies covering registration, payment, delivery and refunds.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
}

const POLICIES = [
  {
    href: '/policies/registration',
    title: 'Registration Policy',
    description: 'How registration and waiting lists work for Edugistics training courses.',
  },
  {
    href: '/policies/payment',
    title: 'Payment Policy',
    description: 'How fees are collected for Edugistics training courses.',
  },
  {
    href: '/policies/refund-and-cancellation',
    title: 'Refund and Cancellation Policy',
    description: 'Refund, cancellation, transfer and substitution terms.',
  },
  {
    href: '/policies/course-transfer',
    title: 'Course Transfer Policy',
    description: 'How to transfer your place to a different course.',
  },
  {
    href: '/policies/attendance',
    title: 'Attendance Policy',
    description: 'Attendance requirements and the effect of a no show.',
  },
  {
    href: '/policies/digital-delivery',
    title: 'Digital Delivery Policy',
    description: 'What you receive after registering, and how courses are delivered.',
  },
  {
    href: '/policies/certificate',
    title: 'Certificate Policy',
    description: 'CPD accreditation and how certificates are issued.',
  },
  {
    href: '/policies/terms-and-conditions',
    title: 'Terms and Conditions',
    description: 'The terms governing bookings made through Edugistics.',
  },
  {
    href: '/policies/privacy',
    title: 'Privacy Policy',
    description: 'How Edugistics collects, uses and protects your information.',
  },
]

export default function PoliciesIndexPage() {
  return (
    <PolicyLayout>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl text-brand-navy">Policies</h1>
        <p className="text-sm text-brand-navy">Last updated: August 2026</p>
      </div>

      <ul className="mt-10 flex flex-col gap-6 sm:mt-12 sm:gap-8">
        {POLICIES.map((policy) => (
          <li key={policy.href} className="flex flex-col gap-1">
            <Link
              href={policy.href}
              className="font-heading text-xl text-brand-navy underline underline-offset-2 sm:text-2xl"
            >
              {policy.title}
            </Link>
            <p className="text-base leading-relaxed text-brand-navy sm:text-lg">
              {policy.description}
            </p>
          </li>
        ))}
      </ul>

      <WhatsAppBubble />
    </PolicyLayout>
  )
}
