'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { PromoCodeDiscountType } from '@/domain/training/promo-code'
import { utcToCairoDateTimeLocal } from '@/domain/training/timezone'
import type { PromoCodeListItem } from '@/lib/training/promo-codes'
import { createPromoCodeAction, updatePromoCodeAction } from '@/app/training/admin/(protected)/promo-codes/actions'
import { PromoCodeCourseMultiSelect, type CourseOption } from './promo-code-course-multi-select'

const DISCOUNT_TYPE_UNIT_OPTIONS: SelectOption[] = [
  { value: 'PERCENTAGE', label: '%' },
  { value: 'FIXED_AMOUNT', label: 'EGP' },
]

const APPLIES_TO_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Courses' },
  { value: 'SELECTED', label: 'Selected Courses' },
]

/** Raw values as the HTML controls actually produce them — the shared promoCodeFormSchema (run server-side inside the action) is the single source of validation truth; this form only shapes the payload. */
interface PromoCodeFormInputs {
  code: string
  description: string
  discountType: PromoCodeDiscountType
  discountValue: string
  appliesToAllCourses: boolean
  courseIds: string[]
  startsAt: string
  expiresAt: string
  maxTotalUses: string
  maxUsesPerTeacher: string
  isPaused: boolean
}

function toCairoDateOnly(date: Date): string {
  return utcToCairoDateTimeLocal(date).slice(0, 10)
}

function toDefaultValues(promoCode?: PromoCodeListItem): PromoCodeFormInputs {
  if (!promoCode) {
    return {
      code: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      appliesToAllCourses: true,
      courseIds: [],
      startsAt: '',
      expiresAt: '',
      maxTotalUses: '',
      maxUsesPerTeacher: '1',
      isPaused: false,
    }
  }
  return {
    code: promoCode.code,
    description: promoCode.description,
    discountType: promoCode.discountType,
    discountValue: String(promoCode.discountValue),
    appliesToAllCourses: promoCode.appliesToAllCourses,
    courseIds: promoCode.courseIds,
    startsAt: promoCode.startsAt ? toCairoDateOnly(promoCode.startsAt) : '',
    expiresAt: promoCode.expiresAt ? toCairoDateOnly(promoCode.expiresAt) : '',
    maxTotalUses: promoCode.maxTotalUses != null ? String(promoCode.maxTotalUses) : '',
    maxUsesPerTeacher: String(promoCode.maxUsesPerTeacher),
    isPaused: promoCode.isPaused,
  }
}

export function PromoCodeForm({
  promoCode,
  courses,
  onSuccess,
}: {
  promoCode?: PromoCodeListItem
  courses: CourseOption[]
  onSuccess: () => void
}) {
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<PromoCodeFormInputs>({ defaultValues: toDefaultValues(promoCode) })

  const appliesToAllCourses = watch('appliesToAllCourses')

  async function onSubmit(values: PromoCodeFormInputs) {
    setFormError(null)
    setIsSubmitting(true)

    const payload = {
      code: values.code,
      description: values.description,
      discountType: values.discountType,
      discountValue: values.discountValue,
      // Not a form field in this phase — the only currency Phase A supports is the column default, supplied here so the FIXED_AMOUNT "currency is required" rule always has something to validate.
      currency: values.discountType === 'FIXED_AMOUNT' ? 'EGP' : undefined,
      appliesToAllCourses: values.appliesToAllCourses,
      courseIds: values.courseIds,
      startsAt: values.startsAt,
      expiresAt: values.expiresAt,
      maxTotalUses: values.maxTotalUses,
      maxUsesPerTeacher: values.maxUsesPerTeacher,
      isPaused: values.isPaused,
    }

    const result = promoCode ? await updatePromoCodeAction(promoCode.id, payload) : await createPromoCodeAction(payload)

    if (!result.success) {
      setFormError(result.error)
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof PromoCodeFormInputs, { message })
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
      <Field>
        <FieldLabel htmlFor="code">Code</FieldLabel>
        <Input id="code" {...register('code')} aria-invalid={Boolean(errors.code)} className="uppercase" />
        <FieldError>{errors.code?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea id="description" rows={2} {...register('description')} aria-invalid={Boolean(errors.description)} />
        <FieldError>{errors.description?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="discountValue">Discount</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="discountValue"
            type="number"
            step="0.01"
            min={0}
            className="flex-1"
            {...register('discountValue')}
            aria-invalid={Boolean(errors.discountValue)}
          />
          <Controller
            name="discountType"
            control={control}
            render={({ field }) => (
              <Select
                items={DISCOUNT_TYPE_UNIT_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                triggerClassName="w-24"
              />
            )}
          />
        </div>
        <FieldError>{errors.discountValue?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="appliesTo">Applies to</FieldLabel>
        <Controller
          name="appliesToAllCourses"
          control={control}
          render={({ field }) => (
            <Select
              id="appliesTo"
              items={APPLIES_TO_OPTIONS}
              value={field.value ? 'ALL' : 'SELECTED'}
              onValueChange={(value) => field.onChange(value === 'ALL')}
            />
          )}
        />
        {!appliesToAllCourses && (
          <Controller
            name="courseIds"
            control={control}
            render={({ field }) => (
              <PromoCodeCourseMultiSelect courses={courses} value={field.value} onChange={field.onChange} />
            )}
          />
        )}
        <FieldError>{errors.courseIds?.message}</FieldError>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="startsAt">Start date (optional)</FieldLabel>
          <Input id="startsAt" type="date" {...register('startsAt')} aria-invalid={Boolean(errors.startsAt)} />
          <FieldError>{errors.startsAt?.message}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="expiresAt">Expiry date (optional)</FieldLabel>
          <Input id="expiresAt" type="date" {...register('expiresAt')} aria-invalid={Boolean(errors.expiresAt)} />
          <FieldError>{errors.expiresAt?.message}</FieldError>
        </Field>
      </div>
      <FieldDescription>Blank dates mean the code is valid immediately and indefinitely.</FieldDescription>

      <Field>
        <FieldLabel htmlFor="maxTotalUses">Maximum total uses (optional)</FieldLabel>
        <Input id="maxTotalUses" type="number" min={1} {...register('maxTotalUses')} aria-invalid={Boolean(errors.maxTotalUses)} />
        <FieldError>{errors.maxTotalUses?.message}</FieldError>
        <FieldDescription>Blank means unlimited uses.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="maxUsesPerTeacher">Maximum uses per teacher</FieldLabel>
        <Input
          id="maxUsesPerTeacher"
          type="number"
          min={1}
          {...register('maxUsesPerTeacher')}
          aria-invalid={Boolean(errors.maxUsesPerTeacher)}
        />
        <FieldError>{errors.maxUsesPerTeacher?.message}</FieldError>
      </Field>

      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="isPaused">Paused</FieldLabel>
          <Controller
            name="isPaused"
            control={control}
            render={({ field }) => <Switch id="isPaused" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
      </Field>

      <FieldError>{formError}</FieldError>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Saving…' : promoCode ? 'Save changes' : 'Create promo code'}
      </Button>
    </form>
  )
}
