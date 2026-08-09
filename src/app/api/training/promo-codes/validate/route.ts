import { NextResponse, type NextRequest } from 'next/server'

import { promoCodeValidationRequestSchema } from '@/domain/training/promo-code-schema'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/training/rate-limit'
import { prisma } from '@/lib/training/prisma'
import { validatePromoCodeForCourse } from '@/lib/training/promo-code-validation'

// Generous enough for a teacher retrying a mistyped code a few times, tight
// enough that brute-forcing a code by trying many values from one IP isn't
// practical — this is a first layer alongside the generic invalid message,
// which never distinguishes "wrong code" from "code exists but not eligible".
const VALIDATE_RATE_LIMIT = 20
const VALIDATE_RATE_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers)
  if (!checkRateLimit(`training-promo-validate:${ip}`, VALIDATE_RATE_LIMIT, VALIDATE_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many attempts from this connection. Please try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const parsed = promoCodeValidationRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const course = await prisma.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { id: true, feeAmount: true, currency: true },
  })
  if (!course) {
    return NextResponse.json({ error: 'This course is no longer available.' }, { status: 400 })
  }

  const result = await validatePromoCodeForCourse({ db: prisma, code: parsed.data.code, course })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  return NextResponse.json({
    data: {
      code: result.promoCode.code,
      discountType: result.promoCode.discountType,
      discountValue: result.promoCode.discountValue,
      currency: result.promoCode.currency,
      originalFee: result.originalFee,
      discountAmount: result.discountAmount,
      finalFee: result.finalFee,
    },
  })
}
