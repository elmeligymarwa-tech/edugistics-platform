import { Suspense } from 'react'
import type { Metadata } from 'next'

import { listCoursesForAdmin } from '@/lib/training/courses'
import { CampaignResumeDialog } from '@/components/training/admin/campaign-resume-dialog'
import { CourseFormDialog } from '@/components/training/admin/course-form-dialog'
import { CoursesTable } from '@/components/training/admin/courses-table'

export const metadata: Metadata = {
  title: 'Courses — Edugistics Training Admin',
}

export default async function TrainingAdminCoursesPage() {
  const courses = await listCoursesForAdmin()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-heading">Courses</h1>
        <CourseFormDialog />
      </div>
      <CoursesTable courses={courses} />
      <Suspense>
        <CampaignResumeDialog />
      </Suspense>
    </div>
  )
}
