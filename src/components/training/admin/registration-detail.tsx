'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DetailItem } from '@/components/ui/detail-item'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminEditRegistrationValues } from '@/domain/training/registration-schema'
import { formatAdminTimestamp, formatCourseFee } from '@/domain/training/format'
import type { RegistrationDetail as RegistrationDetailData } from '@/lib/training/registrations'
import type { CommunicationHistoryItem } from '@/lib/training/email/campaign-analytics'
import { updateRegistrationAction } from '@/app/training/admin/(protected)/registrations/actions'
import { EmailStatusBadge, RegistrationStatusBadge } from './registration-badges'

function SourceBadge({ source }: { source: CommunicationHistoryItem['source'] }) {
  return source === 'CAMPAIGN' ? (
    <Badge variant="brand">Campaign</Badge>
  ) : (
    <Badge variant="outline">Registration</Badge>
  )
}

function toDefaultValues(detail: RegistrationDetailData): AdminEditRegistrationValues {
  return {
    fullName: detail.fullName,
    email: detail.email,
    phone: detail.phone,
    schoolName: detail.schoolName,
    subject: detail.subject,
    grade: detail.grade,
    address: detail.address ?? '',
    marketingConsent: detail.marketingConsent,
  }
}

export function RegistrationDetailView({
  detail,
  startInEdit,
  communicationHistory,
}: {
  detail: RegistrationDetailData
  startInEdit: boolean
  communicationHistory: CommunicationHistoryItem[]
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(startInEdit)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<AdminEditRegistrationValues>({
    defaultValues: toDefaultValues(detail),
  })

  function cancelEditing() {
    reset(toDefaultValues(detail))
    setFormError(null)
    setIsEditing(false)
  }

  async function onSubmit(values: AdminEditRegistrationValues) {
    setFormError(null)
    setIsSubmitting(true)
    const result = await updateRegistrationAction(detail.id, values)
    setIsSubmitting(false)

    if (!result.success) {
      setFormError(result.error)
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof AdminEditRegistrationValues, { message })
        }
      }
      return
    }

    setIsEditing(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Registration {detail.reference}</CardTitle>
            <div className="flex items-center gap-2">
              <RegistrationStatusBadge status={detail.status} />
              <EmailStatusBadge status={detail.emailStatus} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DetailItem label="Course" value={detail.courseName} />
          <DetailItem label="Registered" value={formatAdminTimestamp(detail.registeredAt)} />
          {detail.waitlistPosition != null && (
            <DetailItem label="Waitlist position" value={detail.waitlistPosition} />
          )}
          {detail.promotedAt && <DetailItem label="Promoted" value={formatAdminTimestamp(detail.promotedAt)} />}
          {detail.cancelledAt && <DetailItem label="Cancelled" value={formatAdminTimestamp(detail.cancelledAt)} />}
          {detail.promoCodeSnapshot && (
            <>
              <DetailItem label="Promo code" value={`${detail.promoCodeSnapshot} (${detail.discountLabel})`} />
              <DetailItem
                label="Fee"
                value={`${formatCourseFee(detail.originalFee!, detail.currency)} → ${formatCourseFee(detail.finalFee!, detail.currency)}`}
              />
            </>
          )}
          {detail.emailError && <DetailItem label="Last email error" value={detail.emailError} className="col-span-2 sm:col-span-3" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Teacher details</CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field className="col-span-2">
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input id="fullName" {...register('fullName')} aria-invalid={Boolean(errors.fullName)} />
                  <FieldError>{errors.fullName?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" {...register('email')} aria-invalid={Boolean(errors.email)} />
                  <FieldError>{errors.email?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="phone">Phone</FieldLabel>
                  <Input id="phone" {...register('phone')} aria-invalid={Boolean(errors.phone)} />
                  <FieldError>{errors.phone?.message}</FieldError>
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="address">Address</FieldLabel>
                  <Input id="address" {...register('address')} aria-invalid={Boolean(errors.address)} />
                  <FieldError>{errors.address?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="schoolName">School</FieldLabel>
                  <Input id="schoolName" {...register('schoolName')} aria-invalid={Boolean(errors.schoolName)} />
                  <FieldError>{errors.schoolName?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="subject">Subject</FieldLabel>
                  <Input id="subject" {...register('subject')} aria-invalid={Boolean(errors.subject)} />
                  <FieldError>{errors.subject?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="grade">Grade</FieldLabel>
                  <Input id="grade" {...register('grade')} aria-invalid={Boolean(errors.grade)} />
                  <FieldError>{errors.grade?.message}</FieldError>
                </Field>

                <Field className="col-span-2">
                  <div className="flex items-center gap-2">
                    <Controller
                      name="marketingConsent"
                      control={control}
                      render={({ field }) => (
                        <Checkbox id="marketingConsent" checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <FieldLabel htmlFor="marketingConsent" className="text-foreground">
                      Marketing consent given
                    </FieldLabel>
                  </div>
                </Field>
              </div>

              <FieldError>{formError}</FieldError>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing} disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailItem label="Full name" value={detail.fullName} />
              <DetailItem label="Email" value={detail.email} />
              <DetailItem label="Phone" value={detail.phone} />
              <DetailItem label="Address" value={detail.address ?? '—'} />
              <DetailItem label="School" value={detail.schoolName} />
              <DetailItem label="Subject" value={detail.subject} />
              <DetailItem label="Grade" value={detail.grade} />
              <DetailItem label="Marketing consent" value={detail.marketingConsent ? 'Yes' : 'No'} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Communication history</CardTitle>
        </CardHeader>
        <CardContent>
          {communicationHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">This teacher hasn&apos;t been sent any email yet.</p>
          ) : (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Failure reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {communicationHistory.map((item) => (
                  <TableRow key={`${item.source}-${item.id}`}>
                    <TableCell>{formatAdminTimestamp(item.date)}</TableCell>
                    <TableCell>{item.courseName}</TableCell>
                    <TableCell>{item.subject}</TableCell>
                    <TableCell>{item.emailType}</TableCell>
                    <TableCell>
                      <SourceBadge source={item.source} />
                    </TableCell>
                    <TableCell>
                      <EmailStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>{item.failureReason ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
