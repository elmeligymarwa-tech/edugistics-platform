'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  COURSE_CATEGORY_LABELS,
  CourseCategory,
  DELIVERY_METHOD_LABELS,
  DeliveryMethod,
  type CourseCategory as CourseCategoryType,
  type DeliveryMethod as DeliveryMethodType,
} from '@/domain/training/schema'
import { dateToTimeString } from '@/domain/training/time'
import { utcToCairoDateTimeLocal } from '@/domain/training/timezone'
import type { CourseDetail } from '@/lib/training/courses'
import { createCourseAction, updateCourseAction } from '@/app/training/admin/(protected)/courses/actions'

const CATEGORY_OPTIONS: SelectOption[] = CourseCategory.options.map((value) => ({
  value,
  label: COURSE_CATEGORY_LABELS[value],
}))

const DELIVERY_METHOD_OPTIONS: SelectOption[] = DeliveryMethod.options.map((value) => ({
  value,
  label: DELIVERY_METHOD_LABELS[value],
}))

/**
 * Raw values as the HTML controls actually produce them — numbers and
 * optional fields stay strings here. The server action's courseFormSchema
 * is the single source of validation truth (coercion, nulls, conditional
 * rules); this form only shapes blank strings into null before sending.
 */
interface CourseFormInputs {
  name: string
  shortDescription: string
  fullDescription: string
  category: CourseCategoryType
  courseDate: Date
  startTime: string
  endTime: string
  durationMinutes: string
  deliveryMethod: DeliveryMethodType
  location: string
  joiningInstructions: string
  feeAmount: string
  currency: string
  registrationOpensAt: string
  registrationClosesAt: string
  maxCapacity: string
  waitlistEnabled: boolean
  waitlistCapacity: string
  isActive: boolean
  isFeatured: boolean
}

function toDefaultValues(course?: CourseDetail): CourseFormInputs {
  if (!course) {
    return {
      name: '',
      shortDescription: '',
      fullDescription: '',
      category: 'PROFESSIONAL_DEVELOPMENT',
      courseDate: new Date(),
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: '60',
      deliveryMethod: 'ONLINE',
      location: '',
      joiningInstructions: '',
      feeAmount: '0',
      currency: 'EGP',
      registrationOpensAt: '',
      registrationClosesAt: '',
      maxCapacity: '',
      waitlistEnabled: false,
      waitlistCapacity: '',
      isActive: false,
      isFeatured: false,
    }
  }

  return {
    name: course.name,
    shortDescription: course.shortDescription,
    fullDescription: course.fullDescription,
    category: course.category,
    courseDate: course.courseDate,
    startTime: dateToTimeString(course.startTime),
    endTime: dateToTimeString(course.endTime),
    durationMinutes: String(course.durationMinutes),
    deliveryMethod: course.deliveryMethod,
    location: course.location ?? '',
    joiningInstructions: course.joiningInstructions ?? '',
    feeAmount: String(course.feeAmount),
    currency: course.currency,
    registrationOpensAt: course.registrationOpensAt ? utcToCairoDateTimeLocal(course.registrationOpensAt) : '',
    registrationClosesAt: course.registrationClosesAt ? utcToCairoDateTimeLocal(course.registrationClosesAt) : '',
    maxCapacity: course.maxCapacity != null ? String(course.maxCapacity) : '',
    waitlistEnabled: course.waitlistEnabled,
    waitlistCapacity: course.waitlistCapacity != null ? String(course.waitlistCapacity) : '',
    isActive: course.isActive,
    isFeatured: course.isFeatured,
  }
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function CourseForm({ course, onSuccess }: { course?: CourseDetail; onSuccess: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<CourseFormInputs>({
    defaultValues: toDefaultValues(course),
  })

  const deliveryMethod = watch('deliveryMethod')
  const maxCapacity = watch('maxCapacity')
  const waitlistEnabled = watch('waitlistEnabled')

  async function onSubmit(values: CourseFormInputs) {
    setFormError(null)
    setIsSubmitting(true)

    const payload = {
      ...values,
      location: values.location.trim() || null,
      joiningInstructions: values.joiningInstructions.trim() || null,
      registrationOpensAt: values.registrationOpensAt || null,
      registrationClosesAt: values.registrationClosesAt || null,
      maxCapacity: values.maxCapacity.trim() || null,
      waitlistCapacity: values.waitlistCapacity.trim() || null,
    }

    const result = course ? await updateCourseAction(course.id, payload) : await createCourseAction(payload)

    if (!result.success) {
      setFormError(result.error)
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof CourseFormInputs, { message })
        }
      }
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-1 py-1">
      <div className="grid grid-cols-2 gap-4">
        <Field className="col-span-2">
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" {...register('name')} aria-invalid={Boolean(errors.name)} />
          <FieldError>{errors.name?.message}</FieldError>
        </Field>

        <Field className="col-span-2">
          <FieldLabel htmlFor="shortDescription">Short description</FieldLabel>
          <Textarea
            id="shortDescription"
            rows={2}
            {...register('shortDescription')}
            aria-invalid={Boolean(errors.shortDescription)}
          />
          <FieldError>{errors.shortDescription?.message}</FieldError>
        </Field>

        <Field className="col-span-2">
          <FieldLabel htmlFor="fullDescription">Full description</FieldLabel>
          <Textarea
            id="fullDescription"
            rows={4}
            {...register('fullDescription')}
            aria-invalid={Boolean(errors.fullDescription)}
          />
          <FieldError>{errors.fullDescription?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="category">Category</FieldLabel>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select
                id="category"
                items={CATEGORY_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                aria-invalid={Boolean(errors.category)}
              />
            )}
          />
          <FieldError>{errors.category?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="deliveryMethod">Delivery method</FieldLabel>
          <Controller
            name="deliveryMethod"
            control={control}
            render={({ field }) => (
              <Select
                id="deliveryMethod"
                items={DELIVERY_METHOD_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                aria-invalid={Boolean(errors.deliveryMethod)}
              />
            )}
          />
          <FieldError>{errors.deliveryMethod?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="courseDate">Date</FieldLabel>
          <Controller
            name="courseDate"
            control={control}
            render={({ field }) => (
              <Input
                id="courseDate"
                type="date"
                value={toDateInputValue(field.value)}
                onChange={(event) => field.onChange(new Date(event.target.value))}
                aria-invalid={Boolean(errors.courseDate)}
              />
            )}
          />
          <FieldError>{errors.courseDate?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="durationMinutes">Duration (minutes)</FieldLabel>
          <Input
            id="durationMinutes"
            type="number"
            min={1}
            {...register('durationMinutes')}
            aria-invalid={Boolean(errors.durationMinutes)}
          />
          <FieldError>{errors.durationMinutes?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="startTime">Start time</FieldLabel>
          <Input id="startTime" type="time" {...register('startTime')} aria-invalid={Boolean(errors.startTime)} />
          <FieldError>{errors.startTime?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="endTime">End time</FieldLabel>
          <Input id="endTime" type="time" {...register('endTime')} aria-invalid={Boolean(errors.endTime)} />
          <FieldError>{errors.endTime?.message}</FieldError>
        </Field>

        <Field className="col-span-2">
          <FieldLabel htmlFor="location">Location{deliveryMethod === 'ONLINE' ? ' (optional)' : ''}</FieldLabel>
          <Input id="location" {...register('location')} aria-invalid={Boolean(errors.location)} />
          <FieldError>{errors.location?.message}</FieldError>
        </Field>

        <Field className="col-span-2">
          <FieldLabel htmlFor="joiningInstructions">Joining instructions (optional)</FieldLabel>
          <Textarea id="joiningInstructions" rows={2} {...register('joiningInstructions')} />
        </Field>

        <Field>
          <FieldLabel htmlFor="feeAmount">Fee amount</FieldLabel>
          <Input
            id="feeAmount"
            type="number"
            min={0}
            step="0.01"
            {...register('feeAmount')}
            aria-invalid={Boolean(errors.feeAmount)}
          />
          <FieldError>{errors.feeAmount?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="currency">Currency</FieldLabel>
          <Input id="currency" {...register('currency')} aria-invalid={Boolean(errors.currency)} />
          <FieldError>{errors.currency?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="registrationOpensAt">Registration opens (Cairo time, optional)</FieldLabel>
          <Input id="registrationOpensAt" type="datetime-local" {...register('registrationOpensAt')} />
        </Field>

        <Field>
          <FieldLabel htmlFor="registrationClosesAt">Registration closes (Cairo time, optional)</FieldLabel>
          <Input id="registrationClosesAt" type="datetime-local" {...register('registrationClosesAt')} />
          <FieldError>{errors.registrationClosesAt?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="maxCapacity">Maximum capacity (optional)</FieldLabel>
          <Input id="maxCapacity" type="number" min={1} {...register('maxCapacity')} />
          <FieldDescription>Blank means unlimited.</FieldDescription>
          <FieldError>{errors.maxCapacity?.message}</FieldError>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="waitlistEnabled">Enable waitlist</FieldLabel>
            <Controller
              name="waitlistEnabled"
              control={control}
              render={({ field }) => (
                <Switch
                  id="waitlistEnabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={maxCapacity.trim() === ''}
                />
              )}
            />
          </div>
          <FieldDescription>
            {maxCapacity.trim() === ''
              ? 'Set a maximum capacity to enable the waitlist.'
              : waitlistEnabled
                ? 'Full courses keep collecting names in order.'
                : 'Registration closes when full.'}
          </FieldDescription>
          <FieldError>{errors.waitlistEnabled?.message}</FieldError>
        </Field>

        {waitlistEnabled && (
          <Field>
            <FieldLabel htmlFor="waitlistCapacity">Waitlist capacity (optional)</FieldLabel>
            <Input id="waitlistCapacity" type="number" min={1} {...register('waitlistCapacity')} />
            <FieldError>{errors.waitlistCapacity?.message}</FieldError>
          </Field>
        )}

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="isActive">Active</FieldLabel>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="isFeatured">Featured</FieldLabel>
            <Controller
              name="isFeatured"
              control={control}
              render={({ field }) => (
                <Switch id="isFeatured" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        </Field>
      </div>

      <FieldError>{formError}</FieldError>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Saving…' : course ? 'Save changes' : 'Create course'}
      </Button>
    </form>
  )
}
