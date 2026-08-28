import Link from 'next/link'

import { formatCourseDateOrSessions, formatCourseFee, formatCourseTimeRange } from '@/domain/training/format'
import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import type { PublicCourse } from '@/lib/training/public-courses'

import { LANDING_HEADING_FONT } from './landing-typography'

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edu-teal'

export function CourseCard({ course }: { course: PublicCourse }) {
  const isWaitlisted = course.isFull && course.waitlistEnabled

  return (
    <div className="flex h-full flex-col gap-3 border border-edu-navy/15 border-t-2 border-t-edu-teal bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex shrink-0 items-center rounded-full border border-edu-red px-3 py-1 text-xs font-bold text-edu-navy">
          {DELIVERY_METHOD_LABELS[course.deliveryMethod]}
        </span>
        {isWaitlisted && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-edu-teal-dark px-3 py-1 text-xs font-bold text-white">
            Waiting List
          </span>
        )}
      </div>

      <h3 className={`${LANDING_HEADING_FONT} text-xl text-edu-navy`}>{course.name}</h3>

      <p className="text-sm leading-relaxed text-edu-navy/70">{course.shortDescription}</p>

      <div className="flex flex-col gap-1 text-sm text-edu-navy">
        <p>{formatCourseDateOrSessions(course)}</p>
        <p>{formatCourseTimeRange(course.startTime, course.endTime)}</p>
        <p>
          {DELIVERY_METHOD_LABELS[course.deliveryMethod]}
          {course.location ? ` · ${course.location}` : ''}
        </p>
      </div>

      <p className="text-lg font-bold text-edu-navy">
        {course.feeAmount === 0 ? 'Free' : formatCourseFee(course.feeAmount, course.currency)}
      </p>

      <Link
        href="/training"
        className={`mt-auto inline-flex min-h-11 items-center justify-center rounded bg-edu-gold px-5 py-2.5 text-sm font-bold text-edu-navy ${FOCUS_RING}`}
      >
        Register
      </Link>
    </div>
  )
}
