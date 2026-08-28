import { LANDING_HEADING_FONT } from '@/components/landing/landing-typography'
import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import { formatCourseDateOrSessions, formatCourseFee, formatCourseTimeRange } from '@/domain/training/format'
import type { PublicCourse } from '@/lib/training/public-courses'
import { cn } from '@/lib/utils'

/** A course is unselectable only when it's full with no waitlist — a full course with a waitlist stays clickable so a visitor can join the list. */
export function CourseOptionCard({
  course,
  selected,
  onSelect,
}: {
  course: PublicCourse
  selected: boolean
  onSelect: () => void
}) {
  const isUnselectable = course.isFull && !course.waitlistEnabled
  const isWaitlisted = course.isFull && course.waitlistEnabled

  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-xl border border-t-2 border-t-edu-teal bg-white p-4 transition-colors sm:gap-3 sm:p-6',
        selected ? 'border-edu-teal bg-edu-teal/5' : 'border-edu-navy/15 hover:border-edu-teal/50',
        isUnselectable && 'cursor-not-allowed opacity-60 hover:border-edu-navy/15',
      )}
    >
      <input
        type="radio"
        name="courseId"
        value={course.id}
        checked={selected}
        disabled={isUnselectable}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex shrink-0 items-center rounded-full border border-edu-red px-3 py-1 text-xs font-bold text-edu-navy">
          {DELIVERY_METHOD_LABELS[course.deliveryMethod]}
        </span>
        {isUnselectable && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-edu-navy/10 px-3 py-1 text-xs font-bold text-edu-navy">
            Full
          </span>
        )}
        {isWaitlisted && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-edu-teal-dark px-3 py-1 text-xs font-bold text-white">
            Waiting List
          </span>
        )}
      </div>
      <p className={`${LANDING_HEADING_FONT} text-lg text-edu-navy`}>{course.name}</p>
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
      {course.feeAmount > 0 && (
        <p className="text-xs text-edu-navy/70">
          Payment is not collected through this form. Payment instructions will be sent separately.
        </p>
      )}
      {isWaitlisted && (
        <p className="text-xs font-medium text-edu-teal-dark">This course is full. Join the waiting list.</p>
      )}
    </label>
  )
}
