import { z } from 'zod'

export const marketingTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required.')
    .refine((value) => !/[\r\n]/.test(value), 'Subject cannot contain line breaks.'),
  bodyTemplate: z.string().trim().min(1, 'Message is required.'),
})

export type MarketingTemplateValues = z.infer<typeof marketingTemplateSchema>
