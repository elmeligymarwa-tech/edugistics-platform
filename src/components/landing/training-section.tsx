import Link from 'next/link'

import type { PublicCourse } from '@/lib/training/public-courses'

import { CourseCard } from './course-card'

const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

function availabilityMessage(openCourseCount: number): string {
  if (openCourseCount === 0) {
    return 'New training dates are published to the catalogue as they are confirmed.'
  }
  if (openCourseCount === 1) {
    return '1 course is currently open for registration.'
  }
  return `${openCourseCount} courses are currently open for registration.`
}

export function TrainingSection({
  openCourseCount,
  courses,
}: {
  openCourseCount: number
  courses: PublicCourse[]
}) {
  return (
    <section id="training" className="bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:py-20">
        <div className="grid grid-cols-1 items-end gap-8 sm:grid-cols-[1fr_auto]">
          <div>
            <h2 className={`${HEADING_FONT} max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] tracking-tight text-edu-navy`}>
              Find Training That Fits Your Teaching
            </h2>
            <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-edu-navy/80">
              Explore professional development opportunities designed around teachers, subjects,
              teaching contexts and professional goals.
            </p>
          </div>
          <Link
            href="/training"
            className={`inline-flex min-h-[52px] items-center gap-2 rounded bg-edu-navy px-7 py-4 text-base font-bold text-white hover:bg-edu-teal ${FOCUS_RING}`}
          >
            Browse All Training <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="border border-edu-navy/15 bg-edu-navy/[0.03] p-6 sm:p-8">
          <p className="text-lg leading-relaxed text-edu-navy">{availabilityMessage(openCourseCount)}</p>
        </div>

        {courses.length > 0 && (
          <>
            <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
            <p className="text-sm text-edu-navy/70">Promo codes may apply at registration.</p>
          </>
        )}
      </div>
    </section>
  )
}
