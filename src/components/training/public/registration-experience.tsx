'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { PublicCourse } from '@/lib/training/public-courses'
import { ConfirmationCard, type Confirmation } from './confirmation-card'
import { CourseOptionCard } from './course-option-card'

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

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<RegistrationFormInputs>({ defaultValues: DEFAULT_VALUES })

  async function onSubmit(values: RegistrationFormInputs) {
    setFormError(null)
    setIsSubmitting(true)

    const payload = { ...values, address: values.address.trim() || null }

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
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-foreground">Choose a course</legend>
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
        <FieldError>{errors.courseId?.message}</FieldError>
      </fieldset>

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

      <Controller
        name="marketingConsent"
        control={control}
        render={({ field }) => (
          <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
            <span>I&apos;d like to receive occasional emails about future Edugistics training courses.</span>
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

      <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
        {isSubmitting ? 'Submitting…' : 'Register'}
      </Button>
    </form>
  )
}
