import type { Metadata } from 'next'

import { About } from '@/components/landing/about'
import { AccreditationStrip } from '@/components/landing/accreditation-strip'
import { ContactPrompt } from '@/components/landing/contact-prompt'
import { Hero } from '@/components/landing/hero'
import { LandingHeader } from '@/components/landing/landing-header'
import { WhyEdugistics } from '@/components/landing/why-edugistics'
import { PolicyFooter } from '@/components/policy/policy-footer'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edugistics.online'
const PATH = '/'
const TITLE = 'Edugistics | Professional Development for Teachers'
const DESCRIPTION =
  'Practical professional development courses for teachers, delivered by experienced trainers across core teaching subjects.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}${PATH}` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    siteName: 'Edugistics',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <WhyEdugistics />
        <About />
        <AccreditationStrip />
        <ContactPrompt />
      </main>
      <PolicyFooter />
      <WhatsAppBubble />
    </div>
  )
}
