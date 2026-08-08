import type { Metadata } from 'next'

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
      </div>
      <RegistrationExperience courses={courses} />
    </main>
  )
}
