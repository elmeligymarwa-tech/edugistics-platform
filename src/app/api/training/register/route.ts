import { NextResponse, type NextRequest } from 'next/server'

import { publicRegistrationSchema } from '@/domain/training/registration-schema'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/training/rate-limit'
import { registerForCourse, RegistrationRejectedError } from '@/lib/training/register-for-course'

const REGISTRATION_RATE_LIMIT = 5
const REGISTRATION_RATE_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const parsed = publicRegistrationSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Please fix the highlighted fields.', fieldErrors }, { status: 400 })
  }

  // Honeypot — real visitors never populate this hidden field. Drop silently:
  // no database write, no rate-limit consumption, no distinguishing error.
  if (parsed.data.website) {
    return NextResponse.json({ error: 'Unable to process this submission.' }, { status: 400 })
  }

  const ip = clientIpFromHeaders(request.headers)
  if (!checkRateLimit(`training-registration:${ip}`, REGISTRATION_RATE_LIMIT, REGISTRATION_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many submissions from this connection. Please try again later.' }, { status: 429 })
  }

  const { courseId, fullName, email, phone, schoolName, subject, grade, address, marketingConsent } = parsed.data

  try {
    const outcome = await registerForCourse({
      courseId,
      fullName,
      email,
      phone,
      schoolName,
      subject,
      grade,
      address,
      marketingConsent,
      ip,
    })
    return NextResponse.json({ data: outcome })
  } catch (error) {
    if (error instanceof RegistrationRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
}
