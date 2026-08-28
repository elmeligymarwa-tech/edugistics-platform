import type { Metadata } from 'next'
import Link from 'next/link'

import { LANDING_HEADING_FONT } from '@/components/landing/landing-typography'
import { PolicyFooter } from '@/components/policy/policy-footer'
import { SiteHeader } from '@/components/site-header'
import { RegistrationExperience } from '@/components/training/public/registration-experience'
import { listPublicCourses } from '@/lib/training/public-courses'

export const metadata: Metadata = {
  title: 'Register for training — Edugistics',
  description: 'Register for an upcoming Edugistics teacher training course.',
}

export const dynamic = 'force-dynamic'

export default async function TrainingRegistrationPage() {
  const courses = await listPublicCourses()

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1 px-4 py-5 sm:py-12">
        <div className="mx-auto mb-5 flex max-w-md flex-col items-center gap-1.5 text-center sm:mb-8 sm:gap-2">
          <p className="text-xs font-semibold tracking-wide text-edu-navy uppercase">Edugistics Training</p>
          <h1 className={`${LANDING_HEADING_FONT} text-2xl text-edu-navy sm:text-3xl`}>Register for a course</h1>
          <p className="text-sm text-edu-navy/70">
            Choose a course and enter your details below. It takes less than two minutes.
          </p>
          {/* Separate from the marketing consent checkbox further down — that checkbox is
              about emails, this is about page tracking, and neither implies the other. */}
          <p className="text-xs text-edu-navy/70">
            This page uses Meta Pixel to measure visits and registrations. See our{' '}
            <Link href="/policies/privacy" className="underline underline-offset-2 hover:text-edu-navy">
              privacy notice
            </Link>{' '}
            for what it does and how to opt out.
          </p>
        </div>
        <RegistrationExperience courses={courses} />
      </main>
      <PolicyFooter />
    </div>
  )
}
