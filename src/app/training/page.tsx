import type { Metadata } from 'next'
import Link from 'next/link'

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
    <main className="min-h-dvh bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto mb-8 flex max-w-md flex-col items-center gap-2 text-center">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">Edugistics Training</p>
        <h1 className="font-heading text-2xl text-heading sm:text-3xl">Register for a course</h1>
        <p className="text-sm text-muted-foreground">
          Choose a course and enter your details below. It takes less than two minutes.
        </p>
        {/* Separate from the marketing consent checkbox further down — that checkbox is
            about emails, this is about page tracking, and neither implies the other. */}
        <p className="text-xs text-muted-foreground">
          This page uses Meta Pixel to measure visits and registrations. See our{' '}
          <Link href="/training/privacy" className="underline underline-offset-2 hover:text-foreground">
            privacy notice
          </Link>{' '}
          for what it does and how to opt out.
        </p>
      </div>
      <RegistrationExperience courses={courses} />
    </main>
  )
}
