import { z } from 'zod'

import { cairoDateTimeLocalToUtc } from './timezone'

export const CourseCategory = z.enum([
  'LEADERSHIP',
  'TEACHING_LEARNING',
  'ASSESSMENT',
  'CURRICULUM',
  'SEN',
  'CLASSROOM_MANAGEMENT',
  'TECHNOLOGY',
  'AI',
  'PROFESSIONAL_DEVELOPMENT',
])
export type CourseCategory = z.infer<typeof CourseCategory>

export const DeliveryMethod = z.enum(['ONLINE', 'IN_PERSON', 'HYBRID'])
export type DeliveryMethod = z.infer<typeof DeliveryMethod>

export const CampaignEmailType = z.enum(['REMINDER', 'ZOOM_LINK', 'UPDATE', 'CUSTOM'])
export type CampaignEmailType = z.infer<typeof CampaignEmailType>

export const CAMPAIGN_EMAIL_TYPE_LABELS: Record<CampaignEmailType, string> = {
  REMINDER: 'Training Reminder',
  ZOOM_LINK: 'Zoom Link',
  UPDATE: 'Training Update',
  CUSTOM: 'Custom Email',
}

/** Server and client both need this — the server to paginate the query, the client table to compute page count. Kept outside src/lib/training (marked 'server-only') so the client table component can import it directly. */
export const REGISTRATIONS_PAGE_SIZE = 50

export const COURSE_CATEGORY_LABELS: Record<CourseCategory, string> = {
  LEADERSHIP: 'Leadership',
  TEACHING_LEARNING: 'Teaching & Learning',
  ASSESSMENT: 'Assessment',
  CURRICULUM: 'Curriculum',
  SEN: 'SEN',
  CLASSROOM_MANAGEMENT: 'Classroom Management',
  TECHNOLOGY: 'Technology',
  AI: 'AI',
  PROFESSIONAL_DEVELOPMENT: 'Professional Development',
}

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  HYBRID: 'Hybrid',
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** An optional HTML "datetime-local" input value. Blank strings, undefined and null all normalise to null. */
const optionalDateTimeLocal = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .regex(DATETIME_LOCAL_PATTERN, 'Enter a valid date and time.')
    .nullable()
    .optional()
    .transform((value) => value ?? null),
)

/** Blank strings, undefined and null all normalise to null — form inputs left empty must not trip a min-length check. */
function optionalTrimmedString(message?: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z
      .string()
      .trim()
      .min(1, message)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  )
}

/** Blank strings, undefined and null all normalise to null instead of coercing to 0 — an empty capacity field means "unlimited", not zero. */
function optionalPositiveInt(message: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.coerce.number().int().positive(message).nullable().optional().transform((value) => value ?? null),
  )
}

/** Blank strings, undefined and null all normalise to null — used for durationMinutes, which a multi-day course must NOT carry (see courseFormSchema's superRefine — durationMinutes is simply absent for a multi-day course, not server-computed). */
const optionalPositiveIntStrict = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.coerce.number().int().positive('Duration must be a positive number of minutes.').nullable().optional().transform((value) => value ?? null),
)

/** Blank strings, undefined and null all normalise to null. When present, must be a valid, trimmed URL. */
function optionalUrl(message: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value),
    z.url(message).nullable().optional().transform((value) => value ?? null),
  )
}

const courseBaseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  shortDescription: z.string().trim().min(1, 'Short description is required.'),
  fullDescription: z.string().trim().min(1, 'Full description is required.'),
  category: CourseCategory,
  // The sole date for a single-day course. For a multi-day course this is
  // ignored server-side and re-derived as the earliest sessionDates entry —
  // see toCourseData — but the field stays required here since a single-day
  // submission always needs it.
  courseDate: z.coerce.date({ message: 'Date is required.' }),
  startTime: z.string().regex(TIME_PATTERN, 'Start time must be in HH:MM format.'),
  endTime: z.string().regex(TIME_PATTERN, 'End time must be in HH:MM format.'),
  // Required for a single-day course, forbidden for a multi-day one — see
  // the superRefine below. Optional at this base-shape level so both modes
  // can share one schema.
  durationMinutes: optionalPositiveIntStrict,
  // The specific dates a multi-day course runs on, added one at a time by
  // the admin — empty for a single-day course. At least two unique dates
  // are required for a multi-day course; see the superRefine below.
  sessionDates: z.array(z.coerce.date()).default([]),
  // The form's own claim about its mode — validated for consistency against
  // sessionDates/durationMinutes below, but never trusted as the stored
  // value: toCourseData (courses/actions.ts) derives the persisted
  // isMultiDay from whether sessionDates is non-empty, not from this field.
  // The server is the authority, not the form.
  isMultiDay: z.boolean().default(false),
  deliveryMethod: DeliveryMethod,
  location: optionalTrimmedString(),
  joiningInstructions: optionalTrimmedString(),
  feeAmount: z.coerce.number().min(0, 'Fee cannot be negative.').default(0),
  currency: z.string().trim().min(1).default('EGP'),
  // Raw "datetime-local" input values (no timezone). Interpreted explicitly
  // as Africa/Cairo wall-clock time — see cairoDateTimeLocalToUtc — never as
  // the admin's browser timezone.
  registrationOpensAt: optionalDateTimeLocal,
  registrationClosesAt: optionalDateTimeLocal,
  maxCapacity: optionalPositiveInt('Capacity must be a positive number.'),
  waitlistEnabled: z.boolean().default(false),
  waitlistCapacity: optionalPositiveInt('Waitlist capacity must be a positive number.'),
  isActive: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  // Communication fields — used when sending reminders and joining links to
  // registered teachers (Phase B). All optional; never required to save or
  // activate a course.
  zoomLink: optionalUrl('Enter a valid URL.'),
  zoomMeetingId: optionalTrimmedString(),
  zoomPasscode: optionalTrimmedString(),
  reminderSubject: optionalTrimmedString(),
  reminderMessage: optionalTrimmedString(),
})

/**
 * Course create/edit validation. name, courseDate, startTime, endTime and
 * deliveryMethod are always required — the database column itself has no
 * NULL path for them, so "cannot activate without name, date, start time
 * and delivery method" is enforced simply by them being required to save
 * any course at all, active or not. The remaining rules are conditional.
 */
export const courseFormSchema = courseBaseSchema.superRefine((data, ctx) => {
  if (data.deliveryMethod !== 'ONLINE' && !data.location) {
    ctx.addIssue({
      code: 'custom',
      path: ['location'],
      message: 'Location is required unless the delivery method is online.',
    })
  }

  // Single-day and multi-day are mutually exclusive, and validated by which
  // fields are actually present — not by trusting the submitted isMultiDay
  // flag on its own. isMultiDay is checked too (rather than silently
  // overridden here) so a form/server mismatch surfaces as a validation
  // error instead of being quietly reinterpreted; toCourseData is what
  // ultimately derives the authoritative stored value from sessionDates.
  if (data.isMultiDay) {
    const seen = new Set<string>()
    let hasDuplicate = false
    for (const date of data.sessionDates) {
      const key = date.toISOString().slice(0, 10)
      if (seen.has(key)) hasDuplicate = true
      seen.add(key)
    }
    if (hasDuplicate) {
      ctx.addIssue({ code: 'custom', path: ['sessionDates'], message: 'The same date was added more than once.' })
    } else if (seen.size < 2) {
      ctx.addIssue({ code: 'custom', path: ['sessionDates'], message: 'A multi-day course needs at least two session dates.' })
    }
    if (data.durationMinutes != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMinutes'],
        message: 'A multi-day course cannot also have a duration in minutes.',
      })
    }
  } else {
    if (data.durationMinutes == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMinutes'],
        message: 'Duration must be a positive number of minutes.',
      })
    }
    if (data.sessionDates.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['sessionDates'], message: 'A single-day course cannot have session dates.' })
    }
  }

  if (
    data.registrationOpensAt &&
    data.registrationClosesAt &&
    cairoDateTimeLocalToUtc(data.registrationClosesAt) <= cairoDateTimeLocalToUtc(data.registrationOpensAt)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['registrationClosesAt'],
      message: 'Registration close time must be after the open time.',
    })
  }

  if (data.waitlistEnabled && data.maxCapacity == null) {
    ctx.addIssue({
      code: 'custom',
      path: ['waitlistEnabled'],
      message: 'Waitlist cannot be enabled without a maximum capacity.',
    })
  }
})

export type CourseFormValues = z.infer<typeof courseFormSchema>
