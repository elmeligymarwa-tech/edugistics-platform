'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { MarketingTemplateValues } from '@/domain/training/marketing-template-schema'
import { createMarketingTemplateAction, updateMarketingTemplateAction } from '@/app/training/admin/(protected)/subscribers/templates/actions'
import type { MarketingTemplateListItem } from '@/lib/training/marketing-templates'

function toDefaultValues(template?: MarketingTemplateListItem): MarketingTemplateValues {
  return {
    name: template?.name ?? '',
    subject: template?.subject ?? '',
    bodyTemplate: template?.bodyTemplate ?? '',
  }
}

export function MarketingTemplateForm({
  template,
  onSuccess,
}: {
  template?: MarketingTemplateListItem
  onSuccess: () => void
}) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MarketingTemplateValues>({ defaultValues: toDefaultValues(template) })

  async function onSubmit(values: MarketingTemplateValues) {
    setFormError(null)
    const result = template
      ? await updateMarketingTemplateAction(template.id, values)
      : await createMarketingTemplateAction(values)

    if (!result.success) {
      setFormError(result.error)
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof MarketingTemplateValues, { message })
        }
      }
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="template-name">Name</FieldLabel>
        <Input id="template-name" {...register('name')} aria-invalid={Boolean(errors.name)} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="template-subject">Subject</FieldLabel>
        <Input id="template-subject" {...register('subject')} aria-invalid={Boolean(errors.subject)} />
        <FieldError>{errors.subject?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="template-body">Message</FieldLabel>
        <Textarea id="template-body" rows={10} {...register('bodyTemplate')} aria-invalid={Boolean(errors.bodyTemplate)} />
        <FieldError>{errors.bodyTemplate?.message}</FieldError>
      </Field>

      {formError && <FieldError>{formError}</FieldError>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : template ? 'Save changes' : 'Create template'}
      </Button>
    </form>
  )
}
