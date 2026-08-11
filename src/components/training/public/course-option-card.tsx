import { DELIVERY_METHOD_LABELS } from '@/domain/training/schema'
import { formatCourseDateOrRange, formatCourseFee, formatCourseTimeRange } from '@/domain/training/format'
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

  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors',
        selected ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/40',
        isUnselectable && 'cursor-not-allowed opacity-60 hover:border-border',
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
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-heading">{course.name}</p>
        {isUnselectable && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Full
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{formatCourseDateOrRange(course)}</p>
      <p className="text-sm text-muted-foreground">{formatCourseTimeRange(course.startTime, course.endTime)}</p>
      <p className="text-sm text-muted-foreground">
        {DELIVERY_METHOD_LABELS[course.deliveryMethod]}
        {course.location ? ` · ${course.location}` : ''}
      </p>
      <p className="text-sm font-medium text-foreground">
        {course.feeAmount === 0 ? 'Free' : formatCourseFee(course.feeAmount, course.currency)}
      </p>
      {course.feeAmount > 0 && (
        <p className="text-xs text-muted-foreground">
          Payment is not collected through this form. Payment instructions will be sent separately.
        </p>
      )}
      {course.isFull && course.waitlistEnabled && (
        <p className="text-xs font-medium text-warning">This course is full. Join the waiting list.</p>
      )}
    </label>
  )
}
