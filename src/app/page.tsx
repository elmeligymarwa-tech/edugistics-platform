import type { Metadata } from 'next'

import { About } from '@/components/landing/about'
import { ContactPrompt } from '@/components/landing/contact-prompt'
import { CredentialsStrip } from '@/components/landing/credentials-strip'
import { FaqPreview } from '@/components/landing/faq-preview'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { SiteHeader } from '@/components/site-header'
import { RegisterYourself } from '@/components/landing/register-yourself'
import { SubjectsGrid } from '@/components/landing/subjects-grid'
import { TrainingSection } from '@/components/landing/training-section'
import { WhyEdugistics } from '@/components/landing/why-edugistics'
import { PolicyFooter } from '@/components/policy/policy-footer'
import { WhatsAppBubble } from '@/components/whatsapp-bubble'
import { listPublicCourses } from '@/lib/training/public-courses'

// The open-course count must reflect the database at request time, not a
// build-time snapshot — a course can be published, filled or archived at
// any point, and Next would otherwise prerender this page once and serve
// a stale count until the next deploy.
export const dynamic = 'force-dynamic'

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

export default async function LandingPage() {
  const courses = await listPublicCourses()
  const openCourses = courses.filter((course) => !course.isFull || course.waitlistEnabled)
  const openCourseCount = openCourses.length

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <CredentialsStrip />
        <TrainingSection openCourseCount={openCourseCount} courses={openCourses} />
        <WhyEdugistics />
        <SubjectsGrid />
        <HowItWorks />
        <RegisterYourself />
        <About />
        <FaqPreview />
        <ContactPrompt />
      </main>
      <PolicyFooter />
      <WhatsAppBubble />
    </div>
  )
}
