interface RegistrationWindowCourse {
  isActive: boolean
  archivedAt: Date | null
  registrationOpensAt: Date | null
  registrationClosesAt: Date | null
}

/**
 * registrationOpensAt/registrationClosesAt are absolute UTC instants (already
 * derived from Cairo wall-clock time when the admin set them via
 * cairoDateTimeLocalToUtc) — so comparing against `now` needs no further
 * timezone conversion here, "current Cairo time" and "current instant" are
 * the same check.
 */
export function isCourseOpenForRegistration(course: RegistrationWindowCourse, now: Date = new Date()): boolean {
  if (!course.isActive || course.archivedAt) return false
  if (course.registrationOpensAt && course.registrationOpensAt > now) return false
  if (course.registrationClosesAt && course.registrationClosesAt < now) return false
  return true
}
