import { z } from 'zod'

export const landingSubscribeSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  // Honeypot — real visitors never see or fill this field. Any non-empty
  // value here means the submission is automated and is dropped silently.
  website: z.string().optional(),
})

export type LandingSubscribeValues = z.infer<typeof landingSubscribeSchema>
