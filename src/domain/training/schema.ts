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
  courseDate: z.coerce.date({ message: 'Date is required.' }),
  startTime: z.string().regex(TIME_PATTERN, 'Start time must be in HH:MM format.'),
  endTime: z.string().regex(TIME_PATTERN, 'End time must be in HH:MM format.'),
  durationMinutes: z.coerce.number().int().positive('Duration must be a positive number of minutes.'),
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
