import { z } from 'zod'

export const publicRegistrationSchema = z.object({
  courseId: z.string().trim().min(1, 'Please select a course.'),
  fullName: z.string().trim().min(1, 'Full name is required.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  phone: z.string().trim().min(1, 'Phone number is required.'),
  schoolName: z.string().trim().min(1, 'School or institution is required.'),
  subject: z.string().trim().min(1, 'Subject taught is required.'),
  grade: z.string().trim().min(1, 'Grade or year group taught is required.'),
  address: z.string().trim().min(1, 'Address is required.'),
  marketingConsent: z.boolean().default(false),
  // Honeypot — real visitors never see or fill this field. Any non-empty
  // value here means the submission is automated and is dropped silently.
  website: z.string().optional(),
})

export type PublicRegistrationValues = z.infer<typeof publicRegistrationSchema>

/** Admin edit of a registration's teacher-supplied details — same field rules as the public form, minus the course choice and the honeypot. */
export const adminEditRegistrationSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  phone: z.string().trim().min(1, 'Phone number is required.'),
  schoolName: z.string().trim().min(1, 'School or institution is required.'),
  subject: z.string().trim().min(1, 'Subject taught is required.'),
  grade: z.string().trim().min(1, 'Grade or year group taught is required.'),
  address: z.string().trim().min(1, 'Address is required.'),
  marketingConsent: z.boolean().default(false),
})

export type AdminEditRegistrationValues = z.infer<typeof adminEditRegistrationSchema>
