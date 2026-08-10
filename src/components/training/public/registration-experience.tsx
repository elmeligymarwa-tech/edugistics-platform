'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CURRENT_CONSENT_WORDING } from '@/domain/training/consent-wording'
import { formatCourseDateLong, formatCourseFee, formatCourseTimeRange } from '@/domain/training/format'
import { formatPromoDiscountLabel, type PromoBreakdown } from '@/domain/training/promo-code'
import type { PublicCourse } from '@/lib/training/public-courses'
import { cn } from '@/lib/utils'
import { ConfirmationCard, type Confirmation } from './confirmation-card'
import { CourseOptionCard } from './course-option-card'

type PromoApplyState =
  | { status: 'idle' }
  | { status: 'applying' }
  | { status: 'applied'; promo: PromoBreakdown }
  | { status: 'error'; message: string }

interface PromoValidateErrorBody {
  error: string
}

interface PromoValidateSuccessBody {
  data: {
    code: string
    discountType: PromoBreakdown['discountType']
    discountValue: number
    currency: string
    originalFee: number
    discountAmount: number
    finalFee: number
  }
}

/** A single course is only worth auto-selecting if a visitor could actually submit it — a lone full course with no waitlist would otherwise strand them on an unselectable step 1. */
function isCourseSelectable(course: PublicCourse): boolean {
  return !course.isFull || course.waitlistEnabled
}

/**
 * Raw values as the HTML controls actually produce them, mirroring the
 * pattern in admin CourseForm — the server's publicRegistrationSchema is the
 * single source of validation truth; this form only shapes blank strings
 * into null before sending, and `required` attributes give fast native
 * feedback without duplicating that logic on the client.
 */
interface RegistrationFormInputs {
  courseId: string
  fullName: string
  email: string
  phone: string
  schoolName: string
  subject: string
  grade: string
  address: string
  marketingConsent: boolean
  website: string
}

interface RegisterErrorBody {
  error: string
  fieldErrors?: Record<string, string>
}

const DEFAULT_VALUES: RegistrationFormInputs = {
  courseId: '',
  fullName: '',
  email: '',
  phone: '',
  schoolName: '',
  subject: '',
  grade: '',
  address: '',
  marketingConsent: false,
  website: '',
}

export function RegistrationExperience({ courses }: { courses: PublicCourse[] }) {
  const router = useRouter()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [promoState, setPromoState] = useState<PromoApplyState>({ status: 'idle' })

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegistrationFormInputs>({ defaultValues: DEFAULT_VALUES })

  const selectedCourseId = watch('courseId')
  const selectedCourse = courses.find((course) => course.id === selectedCourseId)

  // A single open course is preselected so the visitor lands straight on step 2 — but only
  // when they could actually submit it; a lone full-with-no-waitlist course still needs step 1
  // so they can see why nothing is selectable.
  useEffect(() => {
    if (courses.length === 1 && isCourseSelectable(courses[0]!)) {
      setValue('courseId', courses[0]!.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching courses invalidates any applied code — it may not be eligible
  // for the new course, and the fee it was calculated against has changed.
  useEffect(() => {
    setPromoCodeInput('')
    setPromoState({ status: 'idle' })
  }, [selectedCourseId])

  async function handleApplyPromo() {
    if (!selectedCourseId || !promoCodeInput.trim()) return
    setPromoState({ status: 'applying' })

    try {
      const response = await fetch('/api/training/promo-codes/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: promoCodeInput.trim(), courseId: selectedCourseId }),
      })
      const body = (await response.json()) as PromoValidateSuccessBody | PromoValidateErrorBody

      if (!response.ok || 'error' in body) {
        setPromoState({ status: 'error', message: (body as PromoValidateErrorBody).error ?? 'Something went wrong. Please try again.' })
        return
      }

      const { data } = body
      setPromoState({
        status: 'applied',
        promo: {
          code: data.code,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountLabel: formatPromoDiscountLabel(data.discountType, data.discountValue, data.currency),
          discountAmount: data.discountAmount,
          originalFee: data.originalFee,
          finalFee: data.finalFee,
          currency: data.currency,
        },
      })
    } catch {
      setPromoState({ status: 'error', message: 'Something went wrong. Please try again.' })
    }
  }

  function handleRemovePromo() {
    setPromoCodeInput('')
    setPromoState({ status: 'idle' })
  }

  async function onSubmit(values: RegistrationFormInputs) {
    setFormError(null)
    setIsSubmitting(true)

    const payload = {
      ...values,
      address: values.address.trim() || null,
      promoCode: promoState.status === 'applied' ? promoState.promo.code : null,
    }

    try {
      const response = await fetch('/api/training/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as { data: Confirmation } | RegisterErrorBody

      if (!response.ok || 'error' in body) {
        const errorBody = body as RegisterErrorBody
        setFormError(errorBody.error ?? 'Something went wrong. Please try again.')
        if (errorBody.fieldErrors) {
          for (const [field, message] of Object.entries(errorBody.fieldErrors)) {
            setError(field as keyof RegistrationFormInputs, { message })
          }
        }
        setIsSubmitting(false)
        return
      }

      setConfirmation(body.data)
    } catch {
      setFormError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  function handleRegisterAnother() {
    setConfirmation(null)
    setFormError(null)
    setPromoCodeInput('')
    setPromoState({ status: 'idle' })
    reset(DEFAULT_VALUES)
    router.refresh()
  }

  if (confirmation) {
    return <ConfirmationCard confirmation={confirmation} onRegisterAnother={handleRegisterAnother} />
  }

  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No courses are currently open for registration. Please check back soon.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex max-w-md flex-col gap-6">
      <fieldset className="m-0 flex w-full flex-col gap-3 border-0 p-0">
        <legend className="mb-1 w-full p-0 text-sm font-semibold text-heading">Step 1. Choose your course</legend>

        {selectedCourse ? (
          <div className="flex flex-col gap-2 rounded-xl border border-primary bg-accent p-4">
            <p className="text-base font-semibold text-heading">{selectedCourse.name}</p>
            <p className="text-sm text-muted-foreground">{formatCourseDateLong(selectedCourse.courseDate)}</p>
            <p className="text-sm text-muted-foreground">
              {formatCourseTimeRange(selectedCourse.startTime, selectedCourse.endTime)}
            </p>
            <p className="text-sm font-medium text-foreground">
              {selectedCourse.feeAmount === 0 ? 'Free' : formatCourseFee(selectedCourse.feeAmount, selectedCourse.currency)}
            </p>
            {courses.length > 1 && (
              <button
                type="button"
                onClick={() => setValue('courseId', '')}
                className="self-start text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Change course
              </button>
            )}
          </div>
        ) : (
          <Controller
            name="courseId"
            control={control}
            rules={{ required: 'Please select a course.' }}
            render={({ field }) => (
              <div role="radiogroup" className="flex flex-col gap-2">
                {courses.map((course) => (
                  <CourseOptionCard
                    key={course.id}
                    course={course}
                    selected={field.value === course.id}
                    onSelect={() => field.onChange(course.id)}
                  />
                ))}
              </div>
            )}
          />
        )}
        <FieldError>{errors.courseId?.message}</FieldError>
      </fieldset>

      <fieldset
        disabled={!selectedCourseId}
        className={cn(
          'm-0 flex w-full flex-col gap-4 border-0 p-0',
          !selectedCourseId && 'pointer-events-none opacity-50',
        )}
      >
        <legend className="mb-1 w-full p-0 text-sm font-semibold text-heading">Step 2. Your details</legend>

        {!selectedCourseId && <p className="-mt-2 text-sm text-muted-foreground">Select a course above to continue.</p>}

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input
              id="fullName"
              autoComplete="name"
              required
              {...register('fullName')}
              aria-invalid={Boolean(errors.fullName)}
            />
            <FieldError>{errors.fullName?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              {...register('email')}
              aria-invalid={Boolean(errors.email)}
            />
            <FieldError>{errors.email?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              {...register('phone')}
              aria-invalid={Boolean(errors.phone)}
            />
            <FieldError>{errors.phone?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="schoolName">Current school or institution</FieldLabel>
            <Input id="schoolName" required {...register('schoolName')} aria-invalid={Boolean(errors.schoolName)} />
            <FieldError>{errors.schoolName?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="subject">Subject taught</FieldLabel>
            <Input id="subject" required {...register('subject')} aria-invalid={Boolean(errors.subject)} />
            <FieldError>{errors.subject?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="grade">Grade or year group taught</FieldLabel>
            <Input id="grade" required {...register('grade')} aria-invalid={Boolean(errors.grade)} />
            <FieldError>{errors.grade?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="address">Address (optional)</FieldLabel>
            <Textarea id="address" rows={2} {...register('address')} />
          </Field>
        </div>

        {selectedCourse && selectedCourse.feeAmount > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <FieldLabel htmlFor="promoCodeInput">Promo code (optional)</FieldLabel>

            {promoState.status === 'applied' ? (
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Original fee</span>
                  <span>{formatCourseFee(promoState.promo.originalFee, promoState.promo.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Promo code</span>
                  <span className="font-medium text-foreground">{promoState.promo.code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>{promoState.promo.discountLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">You save</span>
                  <span>{formatCourseFee(promoState.promo.discountAmount, promoState.promo.currency)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>Final fee</span>
                  <span>{formatCourseFee(promoState.promo.finalFee, promoState.promo.currency)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="self-start text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground">Course fee: {formatCourseFee(selectedCourse.feeAmount, selectedCourse.currency)}</p>
                <div className="flex gap-2">
                  <Input
                    id="promoCodeInput"
                    value={promoCodeInput}
                    onChange={(event) => setPromoCodeInput(event.target.value)}
                    placeholder="Enter code"
                    disabled={promoState.status === 'applying'}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyPromo}
                    disabled={!promoCodeInput.trim() || promoState.status === 'applying'}
                  >
                    {promoState.status === 'applying' ? 'Applying…' : 'Apply'}
                  </Button>
                </div>
                {promoState.status === 'error' && <FieldError>{promoState.message}</FieldError>}
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Payment is not collected through this form. Payment instructions will be sent separately.
            </p>
          </div>
        )}

        {/* Deliberately its own bordered block, separate from the privacy notice below — this is an optional marketing choice, never a condition of registering. */}
        <Controller
          name="marketingConsent"
          control={control}
          render={({ field }) => (
            <label className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!selectedCourseId}
                className="mt-0.5"
              />
              <span>{CURRENT_CONSENT_WORDING}</span>
            </label>
          )}
        />

        {/* Honeypot — hidden from real visitors via CSS and kept out of the tab order; any value here marks the submission as automated. */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        <FieldDescription>
          By submitting this form you agree to our{' '}
          <a href="/training/privacy" className="underline underline-offset-2 hover:text-foreground">
            privacy notice
          </a>
          .
        </FieldDescription>

        <FieldError>{formError}</FieldError>

        <Button type="submit" disabled={isSubmitting || !selectedCourseId} size="lg" className="w-full">
          {isSubmitting ? 'Submitting…' : 'Register'}
        </Button>
      </fieldset>
    </form>
  )
}
